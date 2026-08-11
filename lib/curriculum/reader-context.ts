import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveMissionContext } from "@/lib/mission-workspace/student";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Only an internal `/student/...` path may be returned to (v5/32-.../resource-context-url.ts's
 * safeReturnTo, ported) — an external or protocol-relative URL passed through `returnTo` would
 * otherwise be an open redirect off a page every student's browser trusts.
 */
export function safeReturnTo(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/student/") || candidate.startsWith("//")) return fallback;
  return candidate;
}

export interface ReaderMissionContext { missionId: string; missionTitle: string; expectedResult: string; returnTo: string }

/** Resolves the Mission a Reader was opened from — reuses the same access-checked read model the Workspace uses, so a mission a student cannot reach cannot be impersonated as reading context either. */
export async function loadReaderMissionContext(userId: string, organizationId: string, missionId: string, returnToCandidate: string | null): Promise<ReaderMissionContext | null> {
  const context = await resolveMissionContext(userId, organizationId, missionId);
  if (!context) return null;
  return {
    missionId: context.mission.id, missionTitle: context.mission.title, expectedResult: context.mission.expectedResult,
    returnTo: safeReturnTo(returnToCandidate, `/student/missions/${missionId}`)
  };
}

export interface ResourceProgress { progressPercent: number; bookmarked: boolean }

export async function getResourceProgress(organizationId: string, studentId: string, resourceType: string, resourceId: string): Promise<ResourceProgress | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("student_resource_progress").select("progress_percent,bookmarked")
    .eq("organization_id", organizationId).eq("student_id", studentId).eq("resource_type", resourceType).eq("resource_id", resourceId).maybeSingle();
  if (!data) return null;
  return { progressPercent: Number(data.progress_percent), bookmarked: Boolean(data.bookmarked) };
}

async function upsertProgress(organizationId: string, studentId: string, resourceType: string, resourceId: string, patch: { progress_percent?: number; bookmarked?: boolean }): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { data: existing } = await supabase.from("student_resource_progress").select("progress_percent,bookmarked")
    .eq("organization_id", organizationId).eq("student_id", studentId).eq("resource_type", resourceType).eq("resource_id", resourceId).maybeSingle();
  const { error } = await supabase.from("student_resource_progress").upsert({
    organization_id: organizationId, student_id: studentId, resource_type: resourceType, resource_id: resourceId,
    progress_percent: patch.progress_percent ?? existing?.progress_percent ?? 0,
    bookmarked: patch.bookmarked ?? existing?.bookmarked ?? false,
    last_read_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }, { onConflict: "organization_id,student_id,resource_type,resource_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function recordResourceProgress(organizationId: string, studentId: string, resourceType: string, resourceId: string, progressPercent: number): Promise<Result<null>> {
  return upsertProgress(organizationId, studentId, resourceType, resourceId, { progress_percent: Math.max(0, Math.min(100, Math.round(progressPercent))) });
}

export async function setResourceBookmark(organizationId: string, studentId: string, resourceType: string, resourceId: string, bookmarked: boolean): Promise<Result<null>> {
  return upsertProgress(organizationId, studentId, resourceType, resourceId, { bookmarked });
}

/** "Lưu vào Học & ghi nhớ" from the Reader — reuses learner_notes (migration 0026), now generalized (0053) to accept resource_type/resource_id instead of requiring a Knowledge Space. */
export async function saveResourceNote(organizationId: string, studentId: string, input: { resourceType: string; resourceId: string; missionId?: string | null; title: string; body: string }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { data, error } = await supabase.from("learner_notes").insert({
    organization_id: organizationId, user_id: studentId, resource_type: input.resourceType, resource_id: input.resourceId,
    mission_id: input.missionId ?? null, title: input.title, body: input.body
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "NOTE_SAVE_FAILED" };
  return { ok: true, data: { id: data.id } };
}
