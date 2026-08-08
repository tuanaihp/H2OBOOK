import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AcademyAdminAccess } from "@/lib/academy-admin/types";
import { nextResourcePosition } from "@/lib/career-stages/admin";
import { loadStageNodes } from "./service";
import type { AcademyStageNodeInput, AttachCatalogResourceInput, StageSurface, StudentNavDraft } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Writes go through the request-scoped client so RLS (migration 0041) is the real enforcement —
// same split as lib/career-stages/admin.ts.

export async function createNode(access: AcademyAdminAccess, input: AcademyStageNodeInput): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "TITLE_REQUIRED" };
  if (input.nodeType !== "program" && !input.parentId) return { ok: false, error: "PARENT_REQUIRED" };
  const { data, error } = await supabase.from("academy_stage_nodes").insert({
    organization_id: access.organizationId,
    stage_id: input.stageId,
    parent_id: input.parentId ?? null,
    node_type: input.nodeType,
    title,
    description: input.description ?? null,
    position: input.position ?? (await nextNodePosition(access, input.stageId, input.parentId ?? null)),
    surface: input.surface ?? null,
    status: "active"
  }).select("id").single();
  // The depth trigger (h2obook_validate_stage_node_depth) is the real guard against a module
  // parented to a group, etc. — its exception message is surfaced as-is rather than duplicated here.
  if (error || !data) return { ok: false, error: error?.message ?? "NODE_CREATE_FAILED" };
  return { ok: true, data: { id: String(data.id) } };
}

export async function updateNode(access: AcademyAdminAccess, nodeId: string, input: { title?: string; description?: string; position?: number; status?: "active" | "hidden" | "archived"; surface?: StageSurface | null }): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) {
    if (!input.title.trim()) return { ok: false, error: "TITLE_REQUIRED" };
    patch.title = input.title.trim();
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.position !== undefined) patch.position = input.position;
  if (input.status !== undefined) patch.status = input.status;
  if (input.surface !== undefined) patch.surface = input.surface;
  const { error } = await supabase.from("academy_stage_nodes").update(patch).eq("id", nodeId).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/**
 * Archives a node together with everything under it, and releases the resources that pointed at any
 * of them back to "unassigned" (node_id = null).
 *
 * Both halves matter. Archiving a program alone left its modules active but unreachable: the tree
 * renders modules inside their parent program, and the archived parent is filtered out, so the whole
 * subtree silently disappeared while still counting as live data. Likewise a resource whose node was
 * archived kept pointing at it and vanished from every per-node view — present in the database,
 * invisible in the UI. Releasing them means they resurface under "Chưa phân loại", which is
 * recoverable; leaving them pointed at an archived node is not.
 */
export async function archiveNode(access: AcademyAdminAccess, nodeId: string): Promise<Result<{ archived: number; released: number }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const { data: target } = await supabase.from("academy_stage_nodes").select("id,stage_id").eq("id", nodeId).eq("organization_id", access.organizationId).single();
  if (!target) return { ok: false, error: "STAGE_NODE_NOT_FOUND" };

  const siblings = await loadStageNodes(access.organizationId, String(target.stage_id));
  const ids = new Set<string>([nodeId]);
  // Three passes cover program -> module -> group; a fourth level cannot exist (trigger in 0041).
  for (let depth = 0; depth < 3; depth += 1) {
    for (const node of siblings) {
      if (node.parentId && ids.has(node.parentId)) ids.add(node.id);
    }
  }
  const idList = [...ids];

  const { error } = await supabase.from("academy_stage_nodes").update({ status: "archived", updated_at: new Date().toISOString() }).in("id", idList).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.message };

  const { data: released } = await supabase.from("career_stage_resources").update({ node_id: null, updated_at: new Date().toISOString() }).in("node_id", idList).eq("organization_id", access.organizationId).select("id");
  return { ok: true, data: { archived: idList.length, released: (released ?? []).length } };
}

/**
 * Attaches a catalog item to a stage. resource_type/resource_id are copied from the catalog row's
 * own content_type/source_id — career_stage_resources never points at content_items.id, so deleting
 * a catalog row later cannot orphan a stage's resource list.
 */
export async function attachCatalogResource(access: AcademyAdminAccess, input: AttachCatalogResourceInput): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const { data: item, error: itemError } = await supabase
    .from("content_items")
    .select("id,content_type,source_id,title,summary")
    .eq("organization_id", access.organizationId)
    .eq("id", input.contentItemId)
    .single();
  if (itemError || !item) return { ok: false, error: "CONTENT_ITEM_NOT_FOUND" };

  if (input.nodeId) {
    const { data: node, error: nodeError } = await supabase
      .from("academy_stage_nodes")
      .select("id")
      .eq("organization_id", access.organizationId)
      .eq("stage_id", input.stageId)
      .eq("id", input.nodeId)
      .single();
    if (nodeError || !node) return { ok: false, error: "STAGE_NODE_NOT_FOUND" };
  }

  const { data, error } = await supabase.from("career_stage_resources").insert({
    organization_id: access.organizationId,
    stage_id: input.stageId,
    node_id: input.nodeId ?? null,
    resource_type: item.content_type,
    resource_id: item.source_id,
    // Copied from the catalog item so the card shows a real title immediately — without this the
    // stage list and Content Canvas have nothing to render but the raw resource_id UUID, since
    // career_stage_resources never joins back to its source table for display.
    title_override: item.title ?? null,
    summary: item.summary ?? null,
    surface: input.surface ?? null,
    is_featured: input.isFeatured ?? false,
    position: input.position ?? (await nextResourcePosition(access, input.stageId, input.nodeId ?? null)),
    access: "stage_locked",
    status: "active",
    unlock_mode: "immediate",
    requirement_type: "required",
    display_locations: ["library", "journey"]
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "RESOURCE_ALREADY_ATTACHED" : error?.message ?? "RESOURCE_ATTACH_FAILED" };
  return { ok: true, data: { id: String(data.id) } };
}

/** Re-runs the catalog backfill for this organization (migration 0041's h2obook_sync_content_catalog). */
export async function syncContentCatalog(access: AcademyAdminAccess): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.rpc("h2obook_sync_content_catalog", { p_organization_id: access.organizationId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function saveDraftUiConfig(access: AcademyAdminAccess, stageId: string, config: StudentNavDraft): Promise<Result<{ id: string; version: number }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { data: latest } = await supabase.from("academy_stage_ui_config").select("version").eq("organization_id", access.organizationId).eq("stage_id", stageId).order("version", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = (latest?.version ?? 0) + 1;
  const { data, error } = await supabase.from("academy_stage_ui_config").insert({
    organization_id: access.organizationId,
    stage_id: stageId,
    version: nextVersion,
    status: "draft",
    config,
    created_by: access.userId
  }).select("id,version").single();
  if (error || !data) return { ok: false, error: error?.message ?? "DRAFT_SAVE_FAILED" };
  return { ok: true, data: { id: String(data.id), version: Number(data.version) } };
}

/**
 * Publishing archives whatever was published before and promotes the requested draft — two updates,
 * not a transaction. A crash between them leaves zero published rows (sidebar falls back to
 * compact-navigation.ts, see service.ts) rather than two conflicting published rows, so the failure
 * mode is safe even without an RPC wrapping both steps in one transaction.
 */
export async function publishUiConfig(access: AcademyAdminAccess, stageId: string, version: number): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error: archiveError } = await supabase.from("academy_stage_ui_config").update({ status: "archived", updated_at: new Date().toISOString() }).eq("organization_id", access.organizationId).eq("stage_id", stageId).eq("status", "published");
  if (archiveError) return { ok: false, error: archiveError.message };
  const { error } = await supabase.from("academy_stage_ui_config").update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("organization_id", access.organizationId).eq("stage_id", stageId).eq("version", version).eq("status", "draft");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

async function nextNodePosition(access: AcademyAdminAccess, stageId: string, parentId: string | null): Promise<number> {
  const nodes = await loadStageNodes(access.organizationId, stageId);
  const siblings = nodes.filter((node) => node.parentId === parentId);
  return siblings.reduce((max, node) => Math.max(max, node.position), -1) + 1;
}
