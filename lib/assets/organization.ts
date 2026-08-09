import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectSubtreeIds, toAssetSlug, wouldCreateCycle, type FolderRow } from "./organization-rules";

// Writes go through the request-scoped client so the RLS policies from 0037 are what actually
// enforce the workspace and the role — the route guard is the first check, never the only one. The
// capture_domain_event triggers record before/after themselves, so nothing here writes an audit row.

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function client() {
  return createSupabaseServerClient();
}

export async function listFolders(organizationId: string, options?: { includeArchived?: boolean }): Promise<FolderRow[]> {
  const supabase = await client();
  if (!supabase) return [];
  let query = supabase.from("asset_folders").select("id,parent_id,name,slug,position,archived_at").eq("organization_id", organizationId);
  if (!options?.includeArchived) query = query.is("archived_at", null);
  const { data } = await query.order("position", { ascending: true });
  return (data ?? []).map((row) => ({
    id: String(row.id), parentId: row.parent_id ? String(row.parent_id) : null,
    name: String(row.name), slug: String(row.slug ?? ""), position: Number(row.position ?? 0),
    archivedAt: row.archived_at ? String(row.archived_at) : null
  }));
}

/**
 * How many live assets sit directly in each folder. Drives the count beside each tree node.
 *
 * Grouped by Postgres rather than here: the previous version pulled folder_id for every live asset
 * in the organisation on each render of the tree, so the work grew with the whole library to produce
 * a handful of small numbers. Falls back to that approach when the RPC is missing, so the tree still
 * shows counts on a deployment that precedes migration 0048.
 */
export async function folderAssetCounts(organizationId: string): Promise<Record<string, number>> {
  const supabase = await client();
  if (!supabase) return {};
  const counts: Record<string, number> = {};

  const { data, error } = await supabase.rpc("asset_folder_counts", { p_organization_id: organizationId });
  if (!error && Array.isArray(data)) {
    for (const row of data as { folder_id: string; asset_count: number }[]) {
      counts[String(row.folder_id)] = Number(row.asset_count ?? 0);
    }
    return counts;
  }

  const fallback = await supabase.from("assets").select("folder_id").eq("organization_id", organizationId).is("deleted_at", null).not("folder_id", "is", null);
  for (const row of fallback.data ?? []) {
    const key = String((row as { folder_id: string }).folder_id);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function createFolder(organizationId: string, userId: string, input: { name: string; parentId?: string | null }): Promise<Result<{ id: string }>> {
  const supabase = await client();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "NAME_REQUIRED" };
  const slug = toAssetSlug(name);
  if (!slug) return { ok: false, error: "NAME_REQUIRED" };
  const { data, error } = await supabase.from("asset_folders").insert({
    organization_id: organizationId, parent_id: input.parentId ?? null, name, slug, created_by: userId
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "FOLDER_SLUG_EXISTS" : error?.message ?? "FOLDER_CREATE_FAILED" };
  return { ok: true, data: { id: String(data.id) } };
}

export async function updateFolder(organizationId: string, folderId: string, input: { name?: string; parentId?: string | null; position?: number }): Promise<Result> {
  const supabase = await client();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  if (input.parentId !== undefined) {
    const folders = await listFolders(organizationId, { includeArchived: true });
    if (wouldCreateCycle(folders, folderId, input.parentId)) return { ok: false, error: "FOLDER_CYCLE" };
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "NAME_REQUIRED" };
    patch.name = name;
    patch.slug = toAssetSlug(name);
  }
  if (input.parentId !== undefined) patch.parent_id = input.parentId;
  if (input.position !== undefined) patch.position = input.position;

  const { error } = await supabase.from("asset_folders").update(patch).eq("id", folderId).eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.code === "23505" ? "FOLDER_SLUG_EXISTS" : error.message };
  return { ok: true, data: null };
}

/**
 * Archive, never hard delete. A folder that still holds assets cannot be removed at all — deleting
 * it would either orphan those assets or cascade into losing them, and neither is what "tidy up the
 * folder list" is supposed to mean. Archiving hides the folder and leaves every asset exactly where
 * it is; the assets simply show up under "unfiled" until someone refiles them.
 */
export async function archiveFolder(organizationId: string, folderId: string): Promise<Result<{ archived: number }>> {
  const supabase = await client();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const folders = await listFolders(organizationId, { includeArchived: true });
  const subtree = collectSubtreeIds(folders, folderId);
  const { error } = await supabase.from("asset_folders").update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in("id", subtree).eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { archived: subtree.length } };
}

export async function restoreFolder(organizationId: string, folderId: string): Promise<Result> {
  const supabase = await client();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("asset_folders").update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", folderId).eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface TagRow { id: string; name: string; slug: string; color: string | null; archivedAt: string | null; assetCount: number }

export async function listTags(organizationId: string, options?: { includeArchived?: boolean }): Promise<TagRow[]> {
  const supabase = await client();
  if (!supabase) return [];
  let query = supabase.from("asset_tags").select("id,name,slug,color,archived_at").eq("organization_id", organizationId);
  if (!options?.includeArchived) query = query.is("archived_at", null);
  const [{ data: tags }, { data: links }] = await Promise.all([
    query.order("name", { ascending: true }),
    supabase.from("asset_tag_links").select("tag_id").eq("organization_id", organizationId)
  ]);
  const counts: Record<string, number> = {};
  for (const row of links ?? []) {
    const key = String((row as { tag_id: string }).tag_id);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return (tags ?? []).map((row) => ({
    id: String(row.id), name: String(row.name), slug: String(row.slug ?? ""),
    color: row.color ? String(row.color) : null,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    assetCount: counts[String(row.id)] ?? 0
  }));
}

export async function createTag(organizationId: string, input: { name: string; color?: string }): Promise<Result<{ id: string }>> {
  const supabase = await client();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const name = input.name.trim();
  const slug = toAssetSlug(name);
  if (!name || !slug) return { ok: false, error: "NAME_REQUIRED" };
  const { data, error } = await supabase.from("asset_tags").insert({ organization_id: organizationId, name, slug, color: input.color ?? null }).select("id").single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "TAG_SLUG_EXISTS" : error?.message ?? "TAG_CREATE_FAILED" };
  return { ok: true, data: { id: String(data.id) } };
}

export async function updateTag(organizationId: string, tagId: string, input: { name?: string; color?: string | null; archived?: boolean }): Promise<Result> {
  const supabase = await client();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    const slug = toAssetSlug(name);
    if (!name || !slug) return { ok: false, error: "NAME_REQUIRED" };
    patch.name = name;
    patch.slug = slug;
  }
  if (input.color !== undefined) patch.color = input.color;
  // Archiving a tag keeps its links: an asset does not stop being a before/after shot because
  // someone tidied the tag list, and un-archiving must bring the same assets back.
  if (input.archived !== undefined) patch.archived_at = input.archived ? new Date().toISOString() : null;
  if (Object.keys(patch).length === 0) return { ok: false, error: "NOTHING_TO_UPDATE" };
  const { error } = await supabase.from("asset_tags").update(patch).eq("id", tagId).eq("organization_id", organizationId);
  if (error) return { ok: false, error: error.code === "23505" ? "TAG_SLUG_EXISTS" : error.message };
  return { ok: true, data: null };
}

/** Applies or removes one tag across a set of assets in a single call. */
export async function setTagOnAssets(organizationId: string, tagId: string, assetIds: string[], attach: boolean): Promise<Result<{ affected: number }>> {
  const supabase = await client();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  if (assetIds.length === 0) return { ok: false, error: "NO_ASSETS_SELECTED" };
  if (attach) {
    const { error } = await supabase.from("asset_tag_links")
      .upsert(assetIds.map((assetId) => ({ asset_id: assetId, tag_id: tagId, organization_id: organizationId })), { onConflict: "asset_id,tag_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("asset_tag_links").delete().eq("tag_id", tagId).eq("organization_id", organizationId).in("asset_id", assetIds);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, data: { affected: assetIds.length } };
}

/** Moves only the assets named. Scoped by organization as well as id, so a stray id from another workspace matches nothing. */
export async function moveAssetsToFolder(organizationId: string, assetIds: string[], folderId: string | null): Promise<Result<{ moved: number }>> {
  const supabase = await client();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  if (assetIds.length === 0) return { ok: false, error: "NO_ASSETS_SELECTED" };
  const { data, error } = await supabase.from("assets").update({ folder_id: folderId })
    .in("id", assetIds).eq("organization_id", organizationId).is("deleted_at", null).select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { moved: (data ?? []).length } };
}
