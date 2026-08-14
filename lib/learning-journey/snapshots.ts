import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { average, hasEnoughEvidence, periodBounds, summarizeRecurringReasons } from "./metrics";
import { journeySkillLabel } from "./skill-taxonomy";
import type { CapabilitySnapshot, CapabilitySnapshotType, SkillScoreSummary } from "./types";

interface EntryRow { id: string; journey_day: number | null; practice_minutes: number | null; suspected_reason: string | null; created_at: string }
interface EvidenceRow { skill_key: string; evidence_kind: string; score: number }
interface SnapshotRow {
  id: string; snapshot_type: CapabilitySnapshotType; period_start: string; period_end: string;
  journey_day: number | null; entries_count: number; practice_minutes_total: number;
  skill_scores: SkillScoreSummary[]; recurring_reasons: { reason: string; count: number }[];
  summary: string; has_enough_evidence: boolean; generated_at: string;
}

/**
 * Weekly / Day30 / Day60 / Day90 capability snapshot. "Nếu không đủ evidence, hiển thị 'Chưa đủ
 * Evidence để đánh giá', không tạo score giả" (source spec) — hasEnoughEvidence()/summary below is
 * the enforcement point; callers must not paper over a false hasEnoughEvidence with a fabricated
 * number. Runs through the admin client by design: this is a system-generated assessment, not
 * something a student's own session ever writes (learning_capability_snapshots has no self-insert
 * RLS policy — see migration 0056).
 */
export async function generateCapabilitySnapshot(organizationId: string, studentId: string, snapshotType: CapabilitySnapshotType): Promise<CapabilitySnapshot | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { start, end } = periodBounds(snapshotType);

  const { data: entryRows } = await admin.from("learner_experiences")
    .select("id,journey_day,practice_minutes,suspected_reason,created_at")
    .eq("organization_id", organizationId).eq("user_id", studentId).not("mission_id", "is", null)
    .gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
  const entries = (entryRows ?? []) as EntryRow[];

  let evidence: EvidenceRow[] = [];
  if (entries.length) {
    const entryIds = entries.map((e) => e.id);
    const { data: evidenceRows } = await admin.from("learning_skill_evidence")
      .select("skill_key,evidence_kind,score")
      .eq("organization_id", organizationId).eq("user_id", studentId).eq("source_type", "learner_experiences").in("source_id", entryIds);
    evidence = (evidenceRows ?? []) as EvidenceRow[];
  }

  const bySkill = new Map<string, { self: number[]; instructor: number[] }>();
  for (const row of evidence) {
    const bucket = bySkill.get(row.skill_key) ?? { self: [], instructor: [] };
    if (row.evidence_kind === "instructor") bucket.instructor.push(Number(row.score));
    else bucket.self.push(Number(row.score));
    bySkill.set(row.skill_key, bucket);
  }
  const skillScores: SkillScoreSummary[] = [...bySkill.entries()].map(([skillKey, bucket]) => ({
    skillKey, label: journeySkillLabel(skillKey),
    averageSelfScore: average(bucket.self), averageInstructorScore: average(bucket.instructor),
    evidenceCount: bucket.self.length + bucket.instructor.length, trend: "unknown"
  }));

  const recurringReasons = summarizeRecurringReasons(entries.map((e) => e.suspected_reason));
  const practiceMinutesTotal = entries.reduce((sum, e) => sum + (e.practice_minutes ?? 0), 0);
  const enough = hasEnoughEvidence(entries.length);
  const journeyDay = entries.reduce<number | null>((max, e) => (e.journey_day != null && (max == null || e.journey_day > max) ? e.journey_day : max), null);
  const summary = enough
    ? `${entries.length} lần thực hành, ${practiceMinutesTotal} phút, ${skillScores.length} kỹ năng có evidence.`
    : "Chưa đủ Evidence để đánh giá.";

  const { data: inserted, error } = await admin.from("learning_capability_snapshots").insert({
    organization_id: organizationId, user_id: studentId, snapshot_type: snapshotType,
    period_start: start.toISOString(), period_end: end.toISOString(), journey_day: journeyDay,
    entries_count: entries.length, practice_minutes_total: practiceMinutesTotal,
    skill_scores: skillScores, recurring_reasons: recurringReasons, summary, has_enough_evidence: enough
  }).select("id,generated_at").single();
  if (error || !inserted) return null;

  return {
    id: inserted.id as string, snapshotType, periodStart: start.toISOString(), periodEnd: end.toISOString(),
    journeyDay, entriesCount: entries.length, practiceMinutesTotal, skillScores, recurringReasons,
    summary, hasEnoughEvidence: enough, generatedAt: inserted.generated_at as string
  };
}

export async function listCapabilitySnapshots(organizationId: string, studentId: string, snapshotType?: CapabilitySnapshotType): Promise<CapabilitySnapshot[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  let query = admin.from("learning_capability_snapshots")
    .select("id,snapshot_type,period_start,period_end,journey_day,entries_count,practice_minutes_total,skill_scores,recurring_reasons,summary,has_enough_evidence,generated_at")
    .eq("organization_id", organizationId).eq("user_id", studentId).order("period_start", { ascending: false }).limit(30);
  if (snapshotType) query = query.eq("snapshot_type", snapshotType);
  const { data } = await query;
  return ((data ?? []) as SnapshotRow[]).map((row) => ({
    id: row.id, snapshotType: row.snapshot_type, periodStart: row.period_start, periodEnd: row.period_end,
    journeyDay: row.journey_day, entriesCount: row.entries_count, practiceMinutesTotal: row.practice_minutes_total,
    skillScores: row.skill_scores ?? [], recurringReasons: row.recurring_reasons ?? [], summary: row.summary,
    hasEnoughEvidence: row.has_enough_evidence, generatedAt: row.generated_at
  }));
}
