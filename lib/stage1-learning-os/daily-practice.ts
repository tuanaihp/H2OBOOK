import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface DailyPracticeEntry {
  id: string; date: string; textNote: string; tags: string[]; assetIds: string[]; createdAt: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Daily Practice Journal (docs/stage1-learning-os-v1) — compatibility facade. As of
 * docs/H2O_LEARNING_JOURNEY_AUDIT.md (2026-08-14) the underlying table is learner_experiences
 * (migration 0026, generalized by migration 0056), not learner_notes: learner_experiences already
 * had the richer field shape Learning Journey Intelligence V1 needed (self_score, instructor_score,
 * best_result, suspected_reason…), and learner_notes had zero real production rows for this feature
 * (resource_type='mission' count = 0, verified 2026-08-14), so the move needed no backfill.
 * app/api/student/practice/route.ts and components/student/mission-workspace/daily-practice-
 * logger.tsx keep working unchanged against this exact same exported shape — the richer V1 fields
 * (skill tags, self score, best result…) live in lib/learning-journey/service.ts, which reads/writes
 * the same rows through more columns; this facade only ever sees "textNote" as steps_taken.
 * "tags" has no column on learner_experiences (learner_notes had one, learner_experiences never
 * did) — returned/stored as [] for shape compatibility; no caller ever read a saved tag back, and no
 * real row used the field, so nothing observable changes.
 * "date" has no dedicated column: created_at IS the date, same reasoning as before — a caller-
 * supplied date would let a student backdate practice.
 */
export async function saveDailyPracticeEntry(organizationId: string, studentId: string, input: { missionId: string; textNote: string; assetIds?: string[]; tags?: string[] }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  if (!input.textNote.trim()) return { ok: false, error: "TEXT_NOTE_REQUIRED" };
  // mission_id is a real FK but not org-scoped by itself — without this check a student could tag an
  // entry to another organization's real Mission id (§ "cross-org blocked" test).
  const mission = await supabase.from("learning_journey_missions").select("id").eq("organization_id", organizationId).eq("id", input.missionId).maybeSingle();
  if (!mission.data) return { ok: false, error: "MISSION_NOT_FOUND" };
  const { data, error } = await supabase.from("learner_experiences").insert({
    organization_id: organizationId, user_id: studentId, mission_id: input.missionId,
    title: "", steps_taken: input.textNote.trim(), asset_ids: input.assetIds ?? [],
    visibility: "private", moderation_status: "draft"
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "PRACTICE_SAVE_FAILED" };
  return { ok: true, data: { id: data.id } };
}

/** Every entry the student has logged for Stage 1 — across every Mission, newest first, for the Passport/Practice Lab view. Scoped to rows with a mission_id set (Knowledge-Space case-study rows stay out of Daily Practice). */
export async function listDailyPracticeEntries(organizationId: string, studentId: string, missionId?: string): Promise<DailyPracticeEntry[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  let query = admin.from("learner_experiences").select("id,steps_taken,asset_ids,created_at").eq("organization_id", organizationId).eq("user_id", studentId).not("mission_id", "is", null).order("created_at", { ascending: false });
  if (missionId) query = query.eq("mission_id", missionId);
  const { data } = await query;
  return ((data ?? []) as { id: string; steps_taken: string; asset_ids: string[]; created_at: string }[])
    .map((row) => ({ id: row.id, date: row.created_at, textNote: row.steps_taken, tags: [], assetIds: row.asset_ids, createdAt: row.created_at }));
}
