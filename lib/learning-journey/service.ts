import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { journeyDayFromDate } from "./metrics";
import { isJourneySkillKey } from "./skill-taxonomy";
import type { DailyLogEntry, DailyLogInput, LearningJourneyResult } from "./types";

interface Row {
  id: string; mission_id: string | null; steps_taken: string; best_result: string | null;
  challenges: string | null; suspected_reason: string | null; next_improvement: string | null;
  practice_minutes: number | null; self_score: string | number | null; instructor_score: string | number | null;
  instructor_feedback: string | null; asset_ids: string[]; journey_day: number | null; created_at: string;
}

function toNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toEntry(row: Row, skillKeys: string[]): DailyLogEntry {
  return {
    id: row.id, missionId: row.mission_id, journeyDay: row.journey_day,
    practicedToday: row.steps_taken, bestResult: row.best_result ?? "", problemText: row.challenges ?? "",
    suspectedReason: row.suspected_reason ?? "", nextAction: row.next_improvement ?? "",
    practiceMinutes: row.practice_minutes, selfScore: toNumber(row.self_score), instructorScore: toNumber(row.instructor_score),
    instructorFeedback: row.instructor_feedback, assetIds: row.asset_ids ?? [], skillKeys,
    createdAt: row.created_at
  };
}

/**
 * Creates one Daily Log entry (learner_experiences row) plus one 'practice' learning_skill_evidence
 * row per tagged skill — same source_type/source_id convention lib/stage1-learning-os/skill-
 * evidence.ts's recordStage1SkillEvidence() already established (source_type = the table name,
 * source_id = the row id there). journey_day is computed server-side from the student's own earliest
 * Daily Log row, never accepted as client input — a caller-supplied day would let a student fake
 * progress through the 90-day window.
 */
export async function createDailyLogEntry(organizationId: string, studentId: string, input: DailyLogInput): Promise<LearningJourneyResult<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  if (!input.practicedToday.trim()) return { ok: false, error: "PRACTICED_TODAY_REQUIRED" };

  const mission = await supabase.from("learning_journey_missions").select("id").eq("organization_id", organizationId).eq("id", input.missionId).maybeSingle();
  if (!mission.data) return { ok: false, error: "MISSION_NOT_FOUND" };

  const firstEntry = await supabase.from("learner_experiences").select("created_at").eq("organization_id", organizationId).eq("user_id", studentId).not("mission_id", "is", null).order("created_at", { ascending: true }).limit(1).maybeSingle();
  const nowIso = new Date().toISOString();
  const journeyDay = firstEntry.data ? journeyDayFromDate((firstEntry.data as { created_at: string }).created_at, nowIso) : 1;

  const selfScore = input.selfScore == null ? null : Math.min(100, Math.max(0, input.selfScore));
  const practiceMinutes = input.practiceMinutes == null ? null : Math.max(0, Math.round(input.practiceMinutes));
  const skillKeys = [...new Set((input.skillKeys ?? []).filter(isJourneySkillKey))];

  const { data, error } = await supabase.from("learner_experiences").insert({
    organization_id: organizationId, user_id: studentId, mission_id: input.missionId,
    title: "", steps_taken: input.practicedToday.trim(), best_result: input.bestResult?.trim() || null,
    challenges: input.problemText?.trim() || null, suspected_reason: input.suspectedReason?.trim() || null,
    next_improvement: input.nextAction?.trim() || null, practice_minutes: practiceMinutes,
    self_score: selfScore, journey_day: journeyDay, asset_ids: input.assetIds ?? [],
    visibility: "private", moderation_status: "draft"
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "LOG_SAVE_FAILED" };

  // Admin client here, not the student's session: learning_skill_evidence has a self-insert RLS
  // policy but no self-update one (migration 0028), so an upsert under the student's own session
  // would fail the moment it ever hits the ON CONFLICT UPDATE branch.
  if (skillKeys.length && selfScore != null) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      await admin.from("learning_skill_evidence").upsert(
        skillKeys.map((skillKey) => ({
          organization_id: organizationId, user_id: studentId, skill_key: skillKey,
          evidence_kind: "practice", source_type: "learner_experiences", source_id: data.id, score: selfScore
        })),
        { onConflict: "user_id,skill_key,evidence_kind,source_type,source_id" }
      );
    }
  }

  return { ok: true, data: { id: data.id } };
}

/** 90-day timeline for one student, newest first — every Daily Log entry across every Mission. */
export async function listDailyLogEntries(organizationId: string, studentId: string, missionId?: string): Promise<DailyLogEntry[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  let query = admin.from("learner_experiences")
    .select("id,mission_id,steps_taken,best_result,challenges,suspected_reason,next_improvement,practice_minutes,self_score,instructor_score,instructor_feedback,asset_ids,journey_day,created_at")
    .eq("organization_id", organizationId).eq("user_id", studentId).not("mission_id", "is", null)
    .order("created_at", { ascending: false }).limit(200);
  if (missionId) query = query.eq("mission_id", missionId);
  const { data } = await query;
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const { data: evidenceRows } = await admin.from("learning_skill_evidence").select("skill_key,source_id").eq("organization_id", organizationId).eq("user_id", studentId).eq("source_type", "learner_experiences").in("source_id", ids);
  const skillsBySource = new Map<string, string[]>();
  for (const row of (evidenceRows ?? []) as { skill_key: string; source_id: string }[]) {
    const list = skillsBySource.get(row.source_id) ?? [];
    if (!list.includes(row.skill_key)) list.push(row.skill_key);
    skillsBySource.set(row.source_id, list);
  }

  return rows.map((row) => toEntry(row, skillsBySource.get(row.id) ?? []));
}

/**
 * Instructor review of one Daily Log entry — runs under the TEACHER's session, so must use the admin
 * client: learner_experiences' self-write RLS policy requires user_id=auth.uid() on the row owner,
 * same reasoning recordStage1SkillEvidence documents for learning_skill_evidence.
 */
export async function recordInstructorReview(organizationId: string, entryId: string, input: { instructorScore?: number; instructorFeedback?: string }): Promise<LearningJourneyResult<{ id: string }>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const instructorScore = input.instructorScore == null ? undefined : Math.min(100, Math.max(0, input.instructorScore));
  const patch: Record<string, unknown> = {};
  if (instructorScore !== undefined) patch.instructor_score = instructorScore;
  if (input.instructorFeedback !== undefined) patch.instructor_feedback = input.instructorFeedback.trim() || null;
  if (!Object.keys(patch).length) return { ok: false, error: "NOTHING_TO_UPDATE" };

  const { data: entry } = await admin.from("learner_experiences").select("id,user_id").eq("organization_id", organizationId).eq("id", entryId).maybeSingle();
  if (!entry) return { ok: false, error: "ENTRY_NOT_FOUND" };
  const ownerId = (entry as { user_id: string }).user_id;

  const { error } = await admin.from("learner_experiences").update(patch).eq("id", entryId);
  if (error) return { ok: false, error: error.message };

  if (instructorScore !== undefined) {
    const { data: skillRows } = await admin.from("learning_skill_evidence").select("skill_key").eq("organization_id", organizationId).eq("user_id", ownerId).eq("source_type", "learner_experiences").eq("source_id", entryId).eq("evidence_kind", "practice");
    const skillKeys = [...new Set(((skillRows ?? []) as { skill_key: string }[]).map((r) => r.skill_key))];
    if (skillKeys.length) {
      await admin.from("learning_skill_evidence").upsert(
        skillKeys.map((skillKey) => ({
          organization_id: organizationId, user_id: ownerId, skill_key: skillKey,
          evidence_kind: "instructor", source_type: "learner_experiences", source_id: entryId, score: instructorScore
        })),
        { onConflict: "user_id,skill_key,evidence_kind,source_type,source_id" }
      );
    }
  }

  return { ok: true, data: { id: entryId } };
}
