import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AcademyStageNode, AcademyStageUiConfig, ContentCatalogItem, ContentType, NodeStatus, StageNodeType, StageSurface, StudentNavDraft } from "./types";

type NodeRow = {
  id: string; organization_id: string; stage_id: string; parent_id: string | null;
  node_type: StageNodeType; title: string; description: string | null; position: number; status: NodeStatus;
  surface: string | null;
};

function mapNode(row: NodeRow): Omit<AcademyStageNode, "effectiveSurface"> {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    stageId: String(row.stage_id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    nodeType: row.node_type,
    title: String(row.title),
    description: String(row.description ?? ""),
    position: Number(row.position ?? 0),
    status: row.status,
    surface: (row.surface as StageSurface | null) ?? null
  };
}

/**
 * Fills in effectiveSurface by walking up to the nearest ancestor that declares one. The tree is at
 * most three deep (program -> module -> group, enforced by a trigger in migration 0041), so the walk
 * is bounded; the visited set still guards against a cycle that bad data could introduce.
 */
function withInheritedSurface(nodes: Omit<AcademyStageNode, "effectiveSurface">[]): AcademyStageNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.map((node) => {
    const seen = new Set<string>();
    let cursor: Omit<AcademyStageNode, "effectiveSurface"> | undefined = node;
    while (cursor && !seen.has(cursor.id)) {
      if (cursor.surface) return { ...node, effectiveSurface: cursor.surface };
      seen.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return { ...node, effectiveSurface: null };
  });
}

/** Program/module/group rows for one stage, active+hidden (archived excluded), ordered for tree rendering. */
export async function loadStageNodes(organizationId: string, stageId: string): Promise<AcademyStageNode[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("academy_stage_nodes")
    .select("id,organization_id,stage_id,parent_id,node_type,title,description,position,status,surface")
    .eq("organization_id", organizationId)
    .eq("stage_id", stageId)
    .neq("status", "archived")
    .order("position", { ascending: true });
  return withInheritedSurface(((data ?? []) as NodeRow[]).map(mapNode));
}

/** Program count + resource count per stage, for the stage switcher/overview cards. */
export async function loadStageNodeCounts(organizationId: string, stageIds: string[]): Promise<Map<string, { programCount: number; resourceCount: number }>> {
  const counts = new Map<string, { programCount: number; resourceCount: number }>();
  if (!stageIds.length) return counts;
  const admin = createSupabaseAdminClient();
  if (!admin) return counts;
  const [{ data: nodes }, { data: resources }] = await Promise.all([
    admin.from("academy_stage_nodes").select("stage_id,node_type").eq("organization_id", organizationId).eq("node_type", "program").neq("status", "archived").in("stage_id", stageIds),
    admin.from("career_stage_resources").select("stage_id").eq("organization_id", organizationId).neq("status", "archived").in("stage_id", stageIds)
  ]);
  for (const stageId of stageIds) counts.set(stageId, { programCount: 0, resourceCount: 0 });
  for (const row of (nodes ?? []) as { stage_id: string }[]) {
    const entry = counts.get(row.stage_id);
    if (entry) entry.programCount += 1;
  }
  for (const row of (resources ?? []) as { stage_id: string }[]) {
    const entry = counts.get(row.stage_id);
    if (entry) entry.resourceCount += 1;
  }
  return counts;
}

/**
 * The content catalog, server-side filtered/paginated/searched — a stage with a large library
 * cannot be browsed by loading everything and filtering in the client, the exact problem the asset
 * governance audit called out for the old client-side asset filter.
 */
export async function loadContentCatalog(organizationId: string, options: { q?: string; type?: ContentType; limit?: number; offset?: number }): Promise<{ items: ContentCatalogItem[]; count: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { items: [], count: 0 };
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = admin
    .from("content_items")
    .select("id,content_type,source_table,source_id,title,summary,cover_asset_id,tags,reuse_count,status", { count: "exact" })
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.type) query = query.eq("content_type", options.type);
  if (options.q?.trim()) {
    const q = options.q.trim().replace(/[%_,]/g, " ");
    query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%`);
  }

  type CatalogRow = {
    id: string; content_type: ContentType; source_table: string; source_id: string; title: string;
    summary: string | null; cover_asset_id: string | null; tags: string[] | null; reuse_count: number | null; status: "active" | "archived";
  };
  const { data, count } = await query;
  return {
    items: ((data ?? []) as CatalogRow[]).map((row) => ({
      id: String(row.id),
      contentType: row.content_type,
      sourceTable: String(row.source_table),
      sourceId: String(row.source_id),
      title: String(row.title),
      summary: String(row.summary ?? ""),
      coverAssetId: row.cover_asset_id ? String(row.cover_asset_id) : null,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      reuseCount: Number(row.reuse_count ?? 0),
      status: row.status
    })),
    count: count ?? 0
  };
}

const emptyDraft: StudentNavDraft = { topLevel: [] };

/** Latest draft (if any) and the currently published config for one stage's Student Experience Builder. */
export async function loadStageUiConfig(organizationId: string, stageId: string): Promise<{ draft: AcademyStageUiConfig | null; published: AcademyStageUiConfig | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { draft: null, published: null };
  const [{ data: draftRow }, { data: publishedRow }] = await Promise.all([
    admin.from("academy_stage_ui_config").select("*").eq("organization_id", organizationId).eq("stage_id", stageId).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle(),
    admin.from("academy_stage_ui_config").select("*").eq("organization_id", organizationId).eq("stage_id", stageId).eq("status", "published").maybeSingle()
  ]);
  type UiConfigRow = {
    id: string; organization_id: string; stage_id: string; version: number;
    status: "draft" | "published" | "archived"; config: unknown; published_at: string | null;
  };
  const map = (row: UiConfigRow): AcademyStageUiConfig => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    stageId: String(row.stage_id),
    version: Number(row.version),
    status: row.status,
    config: (row.config && typeof row.config === "object" && Array.isArray((row.config as StudentNavDraft).topLevel)) ? (row.config as StudentNavDraft) : emptyDraft,
    publishedAt: row.published_at ? String(row.published_at) : null
  });
  return { draft: draftRow ? map(draftRow) : null, published: publishedRow ? map(publishedRow) : null };
}
