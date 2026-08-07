import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AcademyAdminAccess } from "@/lib/academy-admin/types";
import { defaultStageSeed, loadCareerStages } from "./service";
import { toStageSlug, type CareerStage, type CareerStageInput, type CareerStageResourceInput } from "./types";

// Writes go through the request-scoped client, not the admin client, so the RLS policies added in
// migration 0033 are the thing actually enforcing owner/admin — the API guard is the first check,
// not the only one. Reads use the admin client (see service.ts) because the public learning-paths
// page has no session at all.

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function listStagesForAdmin(access: AcademyAdminAccess): Promise<CareerStage[]> {
  return loadCareerStages(access.organizationId, { includeHidden: true });
}

export async function createStage(access: AcademyAdminAccess, input: CareerStageInput): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "TITLE_REQUIRED" };
  const slug = toStageSlug(input.slug?.trim() || title);
  if (!slug) return { ok: false, error: "SLUG_REQUIRED" };
  const { data, error } = await supabase.from("career_stages").insert({
    organization_id: access.organizationId,
    slug,
    position: input.position ?? (await nextStagePosition(access)),
    index_label: input.indexLabel ?? null,
    title,
    subtitle: input.subtitle ?? null,
    description: input.description ?? null,
    duration_label: input.durationLabel ?? null,
    skills: input.skills ?? [],
    status: input.status ?? "active"
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "SLUG_ALREADY_EXISTS" : error?.message ?? "STAGE_CREATE_FAILED" };
  return { ok: true, data: { id: String(data.id) } };
}

export async function updateStage(access: AcademyAdminAccess, stageId: string, input: Partial<CareerStageInput>): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) {
    if (!input.title.trim()) return { ok: false, error: "TITLE_REQUIRED" };
    patch.title = input.title.trim();
  }
  if (input.slug !== undefined) patch.slug = toStageSlug(input.slug);
  if (input.position !== undefined) patch.position = input.position;
  if (input.indexLabel !== undefined) patch.index_label = input.indexLabel;
  if (input.subtitle !== undefined) patch.subtitle = input.subtitle;
  if (input.description !== undefined) patch.description = input.description;
  if (input.durationLabel !== undefined) patch.duration_label = input.durationLabel;
  if (input.skills !== undefined) patch.skills = input.skills;
  if (input.status !== undefined) patch.status = input.status;
  const { error } = await supabase.from("career_stages").update(patch).eq("id", stageId).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.code === "23505" ? "SLUG_ALREADY_EXISTS" : error.message };
  return { ok: true, data: null };
}

/**
 * Archive rather than hard delete. A stage that has been referenced by student progress or by a
 * public URL should stop appearing, not vanish in a way that turns those references into dangling
 * ids. Its resources go with it via the same archive.
 */
export async function archiveStage(access: AcademyAdminAccess, stageId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("career_stages").update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", stageId).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.message };
  await supabase.from("career_stage_resources").update({ status: "archived", updated_at: new Date().toISOString() }).eq("stage_id", stageId).eq("organization_id", access.organizationId);
  return { ok: true, data: null };
}

/**
 * Publishing a stage is "make it active" plus recording when — first publish only, later
 * republishes (e.g. after unhiding) do not reset the original published_at.
 */
export async function publishStage(access: AcademyAdminAccess, stageId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { data: existing } = await supabase.from("career_stages").select("published_at").eq("id", stageId).eq("organization_id", access.organizationId).single();
  const patch: Record<string, unknown> = { status: "active", updated_at: new Date().toISOString() };
  if (!existing?.published_at) patch.published_at = new Date().toISOString();
  const { error } = await supabase.from("career_stages").update(patch).eq("id", stageId).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/**
 * A prerequisite chain that loops back on itself never opens — every binding in the cycle waits on
 * one further down, forever. The database cannot express this constraint (it is a walk, not a
 * check), so it is enforced here before the write. Walking is bounded by the number of bindings,
 * so a corrupt chain already in the data cannot spin.
 */
async function prerequisiteWouldLoop(access: AcademyAdminAccess, bindingId: string, prerequisiteId: string): Promise<boolean> {
  if (bindingId === prerequisiteId) return true;
  const stages = await loadCareerStages(access.organizationId, { includeHidden: true });
  const byId = new Map(stages.flatMap((stage) => stage.resources).map((resource) => [resource.id, resource]));
  const seen = new Set<string>([bindingId]);
  let cursor: string | null = prerequisiteId;
  while (cursor) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = byId.get(cursor)?.prerequisiteBindingId ?? null;
  }
  return false;
}

export async function attachResource(access: AcademyAdminAccess, stageId: string, input: CareerStageResourceInput): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const resourceId = input.resourceId?.trim();
  if (!resourceId) return { ok: false, error: "RESOURCE_ID_REQUIRED" };
  const { data, error } = await supabase.from("career_stage_resources").insert({
    organization_id: access.organizationId,
    stage_id: stageId,
    resource_type: input.resourceType,
    resource_id: resourceId,
    title_override: input.title?.trim() || null,
    summary: input.summary?.trim() || null,
    href: input.href?.trim() || null,
    position: input.position ?? (await nextResourcePosition(access, stageId)),
    access: input.access ?? "stage_locked",
    status: input.status ?? "active",
    unlock_mode: input.unlockMode ?? "immediate",
    prerequisite_binding_id: input.prerequisiteBindingId ?? null,
    required_progress: input.requiredProgress ?? null,
    unlock_at: input.unlockAt ?? null,
    requirement_type: input.requirementType ?? "required",
    display_locations: input.displayLocations ?? ["library", "journey"],
    program_id: input.programId ?? null,
    node_id: input.nodeId ?? null,
    surface: input.surface ?? null,
    is_featured: input.isFeatured ?? false
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "RESOURCE_ALREADY_ATTACHED" : error?.message ?? "RESOURCE_ATTACH_FAILED" };
  return { ok: true, data: { id: String(data.id) } };
}

export async function updateResource(access: AcademyAdminAccess, resourceRowId: string, input: Partial<CareerStageResourceInput>): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  if (input.prerequisiteBindingId) {
    if (await prerequisiteWouldLoop(access, resourceRowId, input.prerequisiteBindingId)) {
      return { ok: false, error: "PREREQUISITE_WOULD_LOOP" };
    }
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title_override = input.title.trim() || null;
  if (input.summary !== undefined) patch.summary = input.summary.trim() || null;
  if (input.href !== undefined) patch.href = input.href.trim() || null;
  if (input.position !== undefined) patch.position = input.position;
  if (input.access !== undefined) patch.access = input.access;
  if (input.status !== undefined) patch.status = input.status;
  if (input.unlockMode !== undefined) patch.unlock_mode = input.unlockMode;
  if (input.prerequisiteBindingId !== undefined) patch.prerequisite_binding_id = input.prerequisiteBindingId || null;
  if (input.requiredProgress !== undefined) patch.required_progress = input.requiredProgress;
  if (input.unlockAt !== undefined) patch.unlock_at = input.unlockAt || null;
  if (input.requirementType !== undefined) patch.requirement_type = input.requirementType;
  if (input.displayLocations !== undefined) patch.display_locations = input.displayLocations;
  if (input.programId !== undefined) patch.program_id = input.programId;
  if (input.nodeId !== undefined) patch.node_id = input.nodeId;
  if (input.surface !== undefined) patch.surface = input.surface;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;
  const { error } = await supabase.from("career_stage_resources").update(patch).eq("id", resourceRowId).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/** Detaching a resource from a stage removes a link, not content — a real delete is correct here. */
export async function detachResource(access: AcademyAdminAccess, resourceRowId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("career_stage_resources").delete().eq("id", resourceRowId).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/**
 * Writes the five stages the product shipped with. Refuses when stages already exist so it can
 * never overwrite a curriculum someone has edited — it is a first-run convenience, not a reset.
 */
export async function seedDefaultStages(access: AcademyAdminAccess): Promise<Result<{ created: number }>> {
  const existing = await loadCareerStages(access.organizationId, { includeHidden: true });
  if (existing.length > 0) return { ok: false, error: "STAGES_ALREADY_EXIST" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const rows = defaultStageSeed().map((stage) => ({
    organization_id: access.organizationId,
    slug: stage.slug,
    position: stage.position,
    index_label: stage.indexLabel,
    title: stage.title,
    description: stage.description,
    duration_label: stage.durationLabel,
    skills: stage.skills,
    status: "active"
  }));
  const { error } = await supabase.from("career_stages").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { created: rows.length } };
}

async function nextStagePosition(access: AcademyAdminAccess): Promise<number> {
  const stages = await loadCareerStages(access.organizationId, { includeHidden: true });
  return stages.reduce((max, stage) => Math.max(max, stage.position), -1) + 1;
}

async function nextResourcePosition(access: AcademyAdminAccess, stageId: string): Promise<number> {
  const stages = await loadCareerStages(access.organizationId, { includeHidden: true });
  const stage = stages.find((candidate) => candidate.id === stageId);
  return (stage?.resources ?? []).reduce((max, resource) => Math.max(max, resource.position), -1) + 1;
}
