import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface DailyPracticeEntry {
  id: string; date: string; textNote: string; tags: string[]; assetIds: string[]; createdAt: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Daily Practice Journal (docs/stage1-learning-os-v1) — reuses learner_notes (migration 0026,
 * generalized 0053, `asset_ids` added 0055), the same table the Reader's "Lưu vào Học & ghi nhớ"
 * already writes to (lib/curriculum/reader-context.ts's saveResourceNote). `resource_type:'mission'`
 * satisfies learner_notes_has_a_subject alongside the real `mission_id` FK — not a new subject kind
 * the rest of the app needs to know about, just this table's existing polymorphic escape hatch.
 * "date" has no dedicated column: created_at IS the date, same as every other timestamped log in
 * this schema (student_mission_states.updated_at, domain_events.created_at) — a caller-supplied
 * date would let a student backdate practice, which the source package's own "idempotent/retry-safe"
 * test implies should not be possible.
 */
export async function saveDailyPracticeEntry(organizationId: string, studentId: string, input: { missionId: string; textNote: string; assetIds?: string[]; tags?: string[] }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  if (!input.textNote.trim()) return { ok: false, error: "TEXT_NOTE_REQUIRED" };
  // mission_id is a real FK but not org-scoped by itself — without this check a student could tag an
  // entry to another organization's real Mission id (§ "cross-org blocked" test).
  const mission = await supabase.from("learning_journey_missions").select("id").eq("organization_id", organizationId).eq("id", input.missionId).maybeSingle();
  if (!mission.data) return { ok: false, error: "MISSION_NOT_FOUND" };
  const { data, error } = await supabase.from("learner_notes").insert({
    organization_id: organizationId, user_id: studentId, mission_id: input.missionId,
    resource_type: "mission", resource_id: input.missionId,
    title: "", body: input.textNote.trim(), tags: input.tags ?? [], asset_ids: input.assetIds ?? []
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "PRACTICE_SAVE_FAILED" };
  return { ok: true, data: { id: data.id } };
}

/** Every entry the student has logged for Stage 1 — across every Mission, newest first, for the Passport/Practice Lab view. Scoped to Missions, not every learner_notes row (Knowledge-Space notes stay out of Daily Practice). */
export async function listDailyPracticeEntries(organizationId: string, studentId: string, missionId?: string): Promise<DailyPracticeEntry[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  let query = admin.from("learner_notes").select("id,body,tags,asset_ids,created_at").eq("organization_id", organizationId).eq("user_id", studentId).eq("resource_type", "mission").order("created_at", { ascending: false });
  if (missionId) query = query.eq("mission_id", missionId);
  const { data } = await query;
  return ((data ?? []) as { id: string; body: string; tags: string[]; asset_ids: string[]; created_at: string }[])
    .map((row) => ({ id: row.id, date: row.created_at, textNote: row.body, tags: row.tags, assetIds: row.asset_ids, createdAt: row.created_at }));
}
