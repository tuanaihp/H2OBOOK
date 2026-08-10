import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AcademyAdminAccess } from "@/lib/academy-admin/types";
import type { MissionBlock, MissionBlockType } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireDraftVersion(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, organizationId: string, journeyVersionId: string): Promise<Result<null>> {
  const { data } = await supabase.from("learning_journey_versions").select("status").eq("organization_id", organizationId).eq("id", journeyVersionId).maybeSingle();
  if (!data) return { ok: false, error: "VERSION_NOT_FOUND" };
  if ((data as { status: string }).status !== "draft") return { ok: false, error: "VERSION_NOT_DRAFT" };
  return { ok: true, data: null };
}

/**
 * Reads-then-writes the whole block list as one unit — matches how the Admin builder edits it (one
 * admin, one mission, one save), and keeps position/id integrity trivial to enforce in application
 * code rather than needing per-block SQL. Rejected outright on a published version: editing must go
 * through Clone Version first (lib/learn-outcome/admin.ts's duplicateVersion), the same rule every
 * other Journey write already follows.
 */
async function loadBlocks(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, organizationId: string, journeyVersionId: string, missionId: string): Promise<MissionBlock[]> {
  const { data } = await supabase.from("learning_mission_workspace_configs").select("blocks").eq("organization_id", organizationId).eq("journey_version_id", journeyVersionId).eq("mission_id", missionId).maybeSingle();
  return ((data as { blocks: MissionBlock[] } | null)?.blocks ?? []) as MissionBlock[];
}

async function saveBlocks(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, access: AcademyAdminAccess, journeyVersionId: string, missionId: string, blocks: MissionBlock[]): Promise<Result<null>> {
  const { error } = await supabase.from("learning_mission_workspace_configs").upsert({
    organization_id: access.organizationId, journey_version_id: journeyVersionId, mission_id: missionId,
    blocks, created_by: access.userId, updated_at: new Date().toISOString()
  }, { onConflict: "organization_id,journey_version_id,mission_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function addBlock(access: AcademyAdminAccess, journeyVersionId: string, missionId: string, input: { type: MissionBlockType; label: string; required?: boolean; bindingId?: string; options?: Record<string, unknown> }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, journeyVersionId);
  if (!draftCheck.ok) return draftCheck;
  const label = input.label?.trim();
  if (!label) return { ok: false, error: "LABEL_REQUIRED" };

  const blocks = await loadBlocks(supabase, access.organizationId, journeyVersionId, missionId);
  const id = crypto.randomUUID();
  blocks.push({ id, type: input.type, label, required: input.required ?? false, position: blocks.length, bindingId: input.bindingId, options: input.options });
  const saved = await saveBlocks(supabase, access, journeyVersionId, missionId, blocks);
  if (!saved.ok) return saved;
  return { ok: true, data: { id } };
}

export async function removeBlock(access: AcademyAdminAccess, journeyVersionId: string, missionId: string, blockId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, journeyVersionId);
  if (!draftCheck.ok) return draftCheck;
  // Removing a block from a draft never touches student_mission_workspace_values rows already saved
  // against a published version's config — those are keyed by their own (older) journey_version_id,
  // which this draft is a clone of but does not share rows with (docs/30 §7: "must not delete data
  // of students still on v2"). Nothing to clean up here by construction.
  const blocks = (await loadBlocks(supabase, access.organizationId, journeyVersionId, missionId)).filter((b) => b.id !== blockId).map((b, i) => ({ ...b, position: i }));
  return saveBlocks(supabase, access, journeyVersionId, missionId, blocks);
}

export async function reorderBlocks(access: AcademyAdminAccess, journeyVersionId: string, missionId: string, orderedBlockIds: string[]): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, journeyVersionId);
  if (!draftCheck.ok) return draftCheck;
  const blocks = await loadBlocks(supabase, access.organizationId, journeyVersionId, missionId);
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const reordered = orderedBlockIds.map((id, i) => { const b = byId.get(id); return b ? { ...b, position: i } : null; }).filter((b): b is MissionBlock => b !== null);
  if (reordered.length !== blocks.length) return { ok: false, error: "BLOCK_ID_MISMATCH" };
  return saveBlocks(supabase, access, journeyVersionId, missionId, reordered);
}

export async function updateBlock(access: AcademyAdminAccess, journeyVersionId: string, missionId: string, blockId: string, patch: Partial<Pick<MissionBlock, "label" | "required" | "bindingId" | "options">>): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, journeyVersionId);
  if (!draftCheck.ok) return draftCheck;
  const blocks = await loadBlocks(supabase, access.organizationId, journeyVersionId, missionId);
  const index = blocks.findIndex((b) => b.id === blockId);
  if (index === -1) return { ok: false, error: "BLOCK_NOT_FOUND" };
  blocks[index] = { ...blocks[index], ...patch };
  return saveBlocks(supabase, access, journeyVersionId, missionId, blocks);
}
