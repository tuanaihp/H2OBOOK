import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StageSurface } from "@/lib/academy-control/types";
import { toRuleAction, toRuleConditions, type BrainCandidate, type BrainInboxItem, type BrainMemorySignal, type BrainRule, type SuggestionSource } from "./types";

type AssetRow = {
  id: string; original_name: string | null; title: string | null;
  mime_type: string | null; asset_subtype: string | null; folder_id: string | null;
};

function mapCandidate(row: AssetRow): BrainCandidate {
  return {
    assetId: String(row.id),
    title: String(row.title ?? ""),
    originalName: String(row.original_name ?? ""),
    mimeType: String(row.mime_type ?? ""),
    assetSubtype: row.asset_subtype ? String(row.asset_subtype) : null,
    folderId: row.folder_id ? String(row.folder_id) : null
  };
}

export async function loadBrainRules(organizationId: string): Promise<BrainRule[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("brain_rules")
    .select("id,name,enabled,priority,conditions,actions")
    .eq("organization_id", organizationId)
    .order("priority", { ascending: true });
  return ((data ?? []) as { id: string; name: string; enabled: boolean; priority: number; conditions: unknown; actions: unknown }[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    enabled: Boolean(row.enabled),
    priority: Number(row.priority ?? 100),
    conditions: toRuleConditions(row.conditions),
    actions: toRuleAction(row.actions)
  }));
}

export async function loadMemorySignals(organizationId: string): Promise<BrainMemorySignal[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("brain_memory_signals")
    .select("signal_key,stage_id,node_id,surface,evidence_count")
    .eq("organization_id", organizationId)
    .order("evidence_count", { ascending: false });
  return ((data ?? []) as { signal_key: string; stage_id: string | null; node_id: string | null; surface: string | null; evidence_count: number }[]).map((row) => ({
    signalKey: String(row.signal_key),
    stageId: row.stage_id ? String(row.stage_id) : null,
    nodeId: row.node_id ? String(row.node_id) : null,
    surface: (row.surface as StageSurface | null) ?? null,
    evidenceCount: Number(row.evidence_count ?? 1)
  }));
}

/** The queue with each item's asset facts and its latest suggestion joined in. */
export async function loadBrainInbox(organizationId: string): Promise<BrainInboxItem[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data: itemRows } = await admin
    .from("brain_inbox_items")
    .select("id,source_asset_id,title,status,created_at")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(200);

  const items = (itemRows ?? []) as { id: string; source_asset_id: string | null; title: string; status: BrainInboxItem["status"]; created_at: string }[];
  if (!items.length) return [];

  const assetIds = items.map((item) => item.source_asset_id).filter((id): id is string => Boolean(id));
  const [{ data: assetRows }, { data: suggestionRows }] = await Promise.all([
    assetIds.length
      ? admin.from("assets").select("id,original_name,title,mime_type,asset_subtype,folder_id").in("id", assetIds)
      : Promise.resolve({ data: [] as AssetRow[] }),
    admin.from("brain_suggestions")
      .select("id,inbox_item_id,source,suggested_stage_id,suggested_node_id,surface,confidence,reason,decision,created_at")
      .eq("organization_id", organizationId)
      .in("inbox_item_id", items.map((item) => item.id))
      .order("created_at", { ascending: false })
  ]);

  const assetsById = new Map(((assetRows ?? []) as AssetRow[]).map((row) => [String(row.id), mapCandidate(row)]));
  // Newest first from the query above, so the first one seen per item is the current suggestion.
  const suggestionByItem = new Map<string, BrainInboxItem["suggestion"]>();
  for (const row of (suggestionRows ?? []) as Record<string, unknown>[]) {
    const itemId = String(row.inbox_item_id);
    if (suggestionByItem.has(itemId)) continue;
    suggestionByItem.set(itemId, {
      id: String(row.id),
      source: row.source as SuggestionSource,
      stageId: row.suggested_stage_id ? String(row.suggested_stage_id) : null,
      nodeId: row.suggested_node_id ? String(row.suggested_node_id) : null,
      surface: (row.surface as StageSurface | null) ?? null,
      confidence: Number(row.confidence ?? 0),
      reason: String(row.reason ?? ""),
      decision: row.decision as "pending" | "approved" | "edited" | "rejected"
    });
  }

  return items.map((item) => ({
    id: String(item.id),
    assetId: item.source_asset_id ? String(item.source_asset_id) : null,
    title: String(item.title),
    status: item.status,
    createdAt: String(item.created_at),
    candidate: item.source_asset_id ? assetsById.get(String(item.source_asset_id)) ?? null : null,
    suggestion: suggestionByItem.get(String(item.id)) ?? null
  }));
}

/**
 * Assets that can still be queued. Already-queued ones are excluded; already-attached ones are not,
 * because putting the same resource in two stages is a legitimate thing to do — the unique
 * constraint on (stage, type, id) is what stops the actual duplicate.
 */
export async function loadBrainCandidates(organizationId: string, options: { q?: string; limit?: number }): Promise<BrainCandidate[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);

  const { data: queuedRows } = await admin.from("brain_inbox_items").select("source_asset_id").eq("organization_id", organizationId).neq("status", "archived");
  const queued = new Set(((queuedRows ?? []) as { source_asset_id: string | null }[]).map((row) => String(row.source_asset_id)));

  let query = admin
    .from("assets")
    .select("id,original_name,title,mime_type,asset_subtype,folder_id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit + queued.size);

  if (options.q?.trim()) {
    const q = options.q.trim().replace(/[%_,]/g, " ");
    query = query.or(`title.ilike.%${q}%,original_name.ilike.%${q}%`);
  }

  const { data } = await query;
  return ((data ?? []) as AssetRow[]).filter((row) => !queued.has(String(row.id))).slice(0, limit).map(mapCandidate);
}
