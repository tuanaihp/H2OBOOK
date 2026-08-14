import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { average, trend, summarizeRecurringReasons, hasEnoughEvidence } from "./metrics";
import { journeySkillLabel } from "./skill-taxonomy";
import type { StudentJourneyContext, SkillScoreSummary } from "./types";

interface EntryRow { id: string; journey_day: number | null; practice_minutes: number | null; suspected_reason: string | null; next_improvement: string | null; created_at: string }
interface EvidenceRow { skill_key: string; evidence_kind: string; score: number; created_at: string }

/**
 * H2OBrain student-context aggregation — deterministic only, no AI call inside this module. "Metrics
 * phải deterministic. AI chỉ diễn giải... không để LLM tự bịa score" (source spec): every number here
 * comes straight from real learner_experiences/learning_skill_evidence rows. Any AI mentor consuming
 * this output interprets it; it must never regenerate the numbers itself.
 */
export async function buildStudentJourneyContext(organizationId: string, studentId: string): Promise<StudentJourneyContext> {
  const empty: StudentJourneyContext = { userId: studentId, journeyDay: null, totalEntries: 0, totalPracticeMinutes: 0, lastPracticedAt: null, skills: [], recurringReasons: [], recentNextActions: [], hasEnoughEvidence: false };
  const admin = createSupabaseAdminClient();
  if (!admin) return empty;

  const { data: entryRows } = await admin.from("learner_experiences")
    .select("id,journey_day,practice_minutes,suspected_reason,next_improvement,created_at")
    .eq("organization_id", organizationId).eq("user_id", studentId).not("mission_id", "is", null)
    .order("created_at", { ascending: false }).limit(200);
  const entries = (entryRows ?? []) as EntryRow[];

  const { data: evidenceRows } = await admin.from("learning_skill_evidence")
    .select("skill_key,evidence_kind,score,created_at")
    .eq("organization_id", organizationId).eq("user_id", studentId).eq("source_type", "learner_experiences");
  const evidence = (evidenceRows ?? []) as EvidenceRow[];

  const bySkill = new Map<string, { self: number[]; instructor: number[]; timestamped: { score: number; at: string }[] }>();
  for (const row of evidence) {
    const bucket = bySkill.get(row.skill_key) ?? { self: [], instructor: [], timestamped: [] };
    if (row.evidence_kind === "instructor") bucket.instructor.push(Number(row.score));
    else bucket.self.push(Number(row.score));
    bucket.timestamped.push({ score: Number(row.score), at: row.created_at });
    bySkill.set(row.skill_key, bucket);
  }

  const skills: SkillScoreSummary[] = [...bySkill.entries()]
    .map(([skillKey, bucket]) => {
      const sorted = [...bucket.timestamped].sort((a, b) => a.at.localeCompare(b.at));
      const half = Math.floor(sorted.length / 2);
      const previous = sorted.slice(0, half).map((p) => p.score);
      const recent = sorted.slice(half).map((p) => p.score);
      return {
        skillKey, label: journeySkillLabel(skillKey),
        averageSelfScore: average(bucket.self), averageInstructorScore: average(bucket.instructor),
        evidenceCount: bucket.timestamped.length, trend: trend(recent, previous)
      };
    })
    .sort((a, b) => b.evidenceCount - a.evidenceCount);

  const totalPracticeMinutes = entries.reduce((sum, e) => sum + (e.practice_minutes ?? 0), 0);
  const latestJourneyDay = entries.find((e) => e.journey_day != null)?.journey_day ?? null;
  const recurringReasons = summarizeRecurringReasons(entries.map((e) => e.suspected_reason));
  const recentNextActions = entries.map((e) => e.next_improvement).filter((v): v is string => Boolean(v && v.trim())).slice(0, 5);

  return {
    userId: studentId, journeyDay: latestJourneyDay, totalEntries: entries.length,
    totalPracticeMinutes, lastPracticedAt: entries[0]?.created_at ?? null,
    skills, recurringReasons, recentNextActions, hasEnoughEvidence: hasEnoughEvidence(entries.length)
  };
}
