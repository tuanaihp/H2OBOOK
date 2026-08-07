import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AcademyAdminAccess } from "@/lib/academy-admin/types";
import type { StageSurface } from "@/lib/academy-control/types";
import { attachResource } from "@/lib/career-stages/admin";
import { buildSuggestion, computeSignalKeys } from "./rules";
import { loadBrainRules, loadMemorySignals } from "./service";
import type { BrainCandidate, BrainRuleAction, BrainRuleCondition } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Writes go through the request-scoped client so the RLS policies from migration 0044 are the real
// enforcement — same split as every other admin module here.

/**
 * Queues assets and computes a suggestion for each in the same pass. Rules and memory are loaded
 * once for the whole batch rather than per asset: filing thirty photos at once is the normal case,
 * and the rule set does not change between them.
 */
export async function enqueueAssets(access: AcademyAdminAccess, assetIds: string[]): Promise<Result<{ queued: number; skipped: number }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  if (!assetIds.length) return { ok: false, error: "ASSET_IDS_REQUIRED" };

  const { data: assetRows } = await supabase
    .from("assets")
    .select("id,original_name,title,mime_type,asset_subtype,folder_id")
    .eq("organization_id", access.organizationId)
    .is("deleted_at", null)
    .in("id", assetIds);

  const assets = (assetRows ?? []) as { id: string; original_name: string | null; title: string | null; mime_type: string | null; asset_subtype: string | null; folder_id: string | null }[];
  if (!assets.length) return { ok: false, error: "ASSET_NOT_FOUND" };

  const [rules, signals] = await Promise.all([loadBrainRules(access.organizationId), loadMemorySignals(access.organizationId)]);

  let queued = 0;
  let skipped = 0;
  for (const asset of assets) {
    const candidate: BrainCandidate = {
      assetId: String(asset.id),
      title: String(asset.title ?? ""),
      originalName: String(asset.original_name ?? ""),
      mimeType: String(asset.mime_type ?? ""),
      assetSubtype: asset.asset_subtype ? String(asset.asset_subtype) : null,
      folderId: asset.folder_id ? String(asset.folder_id) : null
    };

    const { data: item, error } = await supabase.from("brain_inbox_items").insert({
      organization_id: access.organizationId,
      source_asset_id: candidate.assetId,
      title: candidate.title || candidate.originalName || `Asset ${candidate.assetId}`,
      status: "review",
      created_by: access.userId
    }).select("id").single();

    // 23505 is the unique(organization_id, source_asset_id) guard: already queued, not an error.
    if (error?.code === "23505") { skipped += 1; continue; }
    if (error || !item) return { ok: false, error: error?.message ?? "ENQUEUE_FAILED" };

    const draft = buildSuggestion(candidate, rules, signals);
    await supabase.from("brain_suggestions").insert({
      organization_id: access.organizationId,
      inbox_item_id: item.id,
      source: draft.source,
      suggested_stage_id: draft.stageId,
      suggested_node_id: draft.nodeId,
      surface: draft.surface,
      confidence: draft.confidence,
      reason: draft.reason
    });
    queued += 1;
  }

  return { ok: true, data: { queued, skipped } };
}

/**
 * Applies a reviewed suggestion to the curriculum.
 *
 * The write itself goes through attachResource — the same function the Stage Workspace uses — so a
 * resource filed by Brain is indistinguishable from one filed by hand, and gets the same defaults,
 * position handling and duplicate constraint. Brain does not have its own path into
 * career_stage_resources, which is the whole point of routing approval through here.
 */
export async function approveSuggestion(access: AcademyAdminAccess, suggestionId: string, override: { stageId?: string; nodeId?: string | null; surface?: StageSurface | null; note?: string }): Promise<Result<{ resourceId: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const { data: suggestion } = await supabase
    .from("brain_suggestions")
    .select("id,inbox_item_id,suggested_stage_id,suggested_node_id,surface,decision")
    .eq("id", suggestionId)
    .eq("organization_id", access.organizationId)
    .single();
  if (!suggestion) return { ok: false, error: "SUGGESTION_NOT_FOUND" };
  if (suggestion.decision !== "pending") return { ok: false, error: "SUGGESTION_ALREADY_DECIDED" };

  const { data: item } = await supabase
    .from("brain_inbox_items")
    .select("id,source_asset_id")
    .eq("id", suggestion.inbox_item_id)
    .eq("organization_id", access.organizationId)
    .single();
  if (!item?.source_asset_id) return { ok: false, error: "INBOX_ITEM_HAS_NO_ASSET" };

  const stageId = override.stageId || (suggestion.suggested_stage_id ? String(suggestion.suggested_stage_id) : "");
  if (!stageId) return { ok: false, error: "STAGE_REQUIRED" };
  const nodeId = override.nodeId !== undefined ? override.nodeId : suggestion.suggested_node_id ? String(suggestion.suggested_node_id) : null;
  const surface = override.surface !== undefined ? override.surface : (suggestion.surface as StageSurface | null) ?? null;
  const edited = Boolean(override.stageId && override.stageId !== suggestion.suggested_stage_id) || override.nodeId !== undefined || override.surface !== undefined;

  const attached = await attachResource(access, stageId, {
    resourceType: "asset",
    resourceId: String(item.source_asset_id),
    nodeId,
    surface,
    access: "stage_locked",
    status: "active"
  });
  if (!attached.ok) return { ok: false, error: attached.error };

  await supabase.from("brain_suggestions").update({
    decision: edited ? "edited" : "approved",
    reviewer_note: override.note ?? null,
    reviewed_by: access.userId,
    reviewed_at: new Date().toISOString(),
    applied_resource_id: attached.data.id,
    updated_at: new Date().toISOString()
  }).eq("id", suggestionId).eq("organization_id", access.organizationId);

  await supabase.from("brain_inbox_items").update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", item.id).eq("organization_id", access.organizationId);

  await rememberDecision(access, String(item.source_asset_id), { stageId, nodeId, surface });

  return { ok: true, data: { resourceId: attached.data.id } };
}

/**
 * Records where this kind of asset ended up, so the next one like it arrives pre-filed.
 *
 * Deliberately upsert-by-destination: confirming the same pairing again raises evidence_count,
 * while filing the same kind somewhere else adds a second row rather than overwriting the first.
 * Both destinations then compete on how often they were actually chosen, which is what makes the
 * count mean something.
 */
async function rememberDecision(access: AcademyAdminAccess, assetId: string, destination: { stageId: string; nodeId: string | null; surface: StageSurface | null }): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const { data: asset } = await supabase
    .from("assets")
    .select("id,original_name,title,mime_type,asset_subtype,folder_id")
    .eq("id", assetId)
    .eq("organization_id", access.organizationId)
    .single();
  if (!asset) return;

  const keys = computeSignalKeys({
    assetId,
    title: String(asset.title ?? ""),
    originalName: String(asset.original_name ?? ""),
    mimeType: String(asset.mime_type ?? ""),
    assetSubtype: asset.asset_subtype ? String(asset.asset_subtype) : null,
    folderId: asset.folder_id ? String(asset.folder_id) : null
  });

  for (const signalKey of keys) {
    const { data: existing } = await supabase
      .from("brain_memory_signals")
      .select("id,evidence_count")
      .eq("organization_id", access.organizationId)
      .eq("signal_key", signalKey)
      .eq("stage_id", destination.stageId)
      .maybeSingle();

    if (existing) {
      await supabase.from("brain_memory_signals").update({
        evidence_count: Number(existing.evidence_count ?? 1) + 1,
        last_confirmed_by: access.userId,
        last_confirmed_at: new Date().toISOString()
      }).eq("id", existing.id).eq("organization_id", access.organizationId);
    } else {
      await supabase.from("brain_memory_signals").insert({
        organization_id: access.organizationId,
        signal_key: signalKey,
        stage_id: destination.stageId,
        node_id: destination.nodeId,
        surface: destination.surface,
        last_confirmed_by: access.userId
      });
    }
  }
}

export async function rejectSuggestion(access: AcademyAdminAccess, suggestionId: string, note?: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { data: suggestion } = await supabase.from("brain_suggestions").select("id,inbox_item_id").eq("id", suggestionId).eq("organization_id", access.organizationId).single();
  if (!suggestion) return { ok: false, error: "SUGGESTION_NOT_FOUND" };

  await supabase.from("brain_suggestions").update({
    decision: "rejected", reviewer_note: note ?? null, reviewed_by: access.userId,
    reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }).eq("id", suggestionId).eq("organization_id", access.organizationId);

  await supabase.from("brain_inbox_items").update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", suggestion.inbox_item_id).eq("organization_id", access.organizationId);

  return { ok: true, data: null };
}

/** Removing a queue row is a real delete: it is a to-do entry, not a record of anything that happened. */
export async function removeInboxItem(access: AcademyAdminAccess, itemId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("brain_inbox_items").delete().eq("id", itemId).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function createRule(access: AcademyAdminAccess, input: { name: string; priority?: number; conditions: BrainRuleCondition[]; actions: BrainRuleAction }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "NAME_REQUIRED" };
  if (!input.conditions.length) return { ok: false, error: "CONDITION_REQUIRED" };
  if (!input.actions.stageId && !input.actions.nodeId && !input.actions.surface) return { ok: false, error: "ACTION_REQUIRED" };
  const { data, error } = await supabase.from("brain_rules").insert({
    organization_id: access.organizationId,
    name,
    priority: input.priority ?? 100,
    conditions: input.conditions,
    actions: input.actions,
    created_by: access.userId
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "RULE_CREATE_FAILED" };
  return { ok: true, data: { id: String(data.id) } };
}

export async function updateRule(access: AcademyAdminAccess, ruleId: string, input: { name?: string; enabled?: boolean; priority?: number }): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) {
    if (!input.name.trim()) return { ok: false, error: "NAME_REQUIRED" };
    patch.name = input.name.trim();
  }
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.priority !== undefined) patch.priority = input.priority;
  const { error } = await supabase.from("brain_rules").update(patch).eq("id", ruleId).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function deleteRule(access: AcademyAdminAccess, ruleId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("brain_rules").delete().eq("id", ruleId).eq("organization_id", access.organizationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
