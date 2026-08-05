import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadCareerStages } from "@/lib/career-stages/service";
import { getUnlockedStageIds } from "@/lib/student/stage-access";
import type { AccessGrantFact, ProgressFact, ResourceAccessFacts, StageAccessFact, UnlockMode } from "./domain";

// Gathers the facts the resolver needs from the tables this repo already has. The source module
// wanted a ca_* mirror of everything; nothing is mirrored here — entitlements, memberships,
// career_stages and career_stage_resources are read directly.

type EntitlementRow = { resource_type: string; resource_id: string; status: string; starts_at: string | null; expires_at: string | null; reason: string | null; source_type: string | null };

function grantKind(sourceType: string | null): AccessGrantFact["grantKind"] {
  if (sourceType === "order" || sourceType === "purchase") return "purchase";
  if (sourceType === "manual") return "admin";
  return "legacy";
}

/**
 * A revoked entitlement becomes a deny for that resource, not merely an inactive grant. See the
 * integration report §6: if an admin revoked access to X, a membership should not quietly restore
 * it. Stricter than the alternative, and reversible — it is one branch here, not schema.
 */
function toGrantFacts(rows: EntitlementRow[]): AccessGrantFact[] {
  return rows.map((row) => ({
    effect: row.status === "revoked" ? "deny" as const : "grant" as const,
    grantKind: row.status === "revoked" ? "revoke" as const : grantKind(row.source_type),
    reason: String(row.reason ?? ""),
    startsAt: String(row.starts_at ?? new Date(0).toISOString()),
    // A revocation has no natural end; leaving expires_at on it would let the deny lapse and
    // silently hand access back.
    expiresAt: row.status === "revoked" ? null : row.expires_at
  }));
}

export interface ResourceKey { resourceType: string; resourceId: string }

export interface StudentAccessContext {
  organizationId: string;
  userId: string;
  now: string;
  grantsByResource: Map<string, AccessGrantFact[]>;
  stagesByResource: Map<string, StageAccessFact[]>;
  freeResources: Set<string>;
  hasMembership: boolean;
}

export function resourceKey(key: ResourceKey): string {
  return `${key.resourceType}:${key.resourceId}`;
}

/**
 * One round of reads for the whole screen, rather than per resource. Everything the resolver needs
 * for every resource in the curriculum comes back in a single context.
 */
export async function loadStudentAccessContext(userId: string, organizationId: string): Promise<StudentAccessContext | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const now = new Date().toISOString();

  const [stages, unlockedStageSlugs, entitlementsResult, membershipResult] = await Promise.all([
    loadCareerStages(organizationId),
    getUnlockedStageIds(userId, organizationId),
    admin.from("entitlements").select("resource_type,resource_id,status,starts_at,expires_at,reason,source_type").eq("organization_id", organizationId).eq("user_id", userId),
    admin.from("memberships").select("id").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active").or(`expires_at.is.null,expires_at.gt.${now}`).limit(1).maybeSingle()
  ]);

  const hasMembership = Boolean(membershipResult.data);

  const grantsByResource = new Map<string, AccessGrantFact[]>();
  for (const row of (entitlementsResult.data ?? []) as EntitlementRow[]) {
    const key = resourceKey({ resourceType: String(row.resource_type), resourceId: String(row.resource_id) });
    const existing = grantsByResource.get(key) ?? [];
    grantsByResource.set(key, [...existing, ...toGrantFacts([row])]);
  }

  const stagesByResource = new Map<string, StageAccessFact[]>();
  const freeResources = new Set<string>();
  stages.forEach((stage, index) => {
    const stageUnlocked = unlockedStageSlugs.has(stage.slug);
    for (const resource of stage.resources) {
      const key = resourceKey(resource);
      if (resource.access === "free_preview") freeResources.add(key);
      // entitlement_only bindings never open from the stage itself — they wait for a grant, which
      // the resolver has already considered by the time stage rules are reached.
      if (resource.access === "entitlement_only") continue;
      const fact: StageAccessFact = {
        stageSlug: stage.slug,
        stageName: stage.title,
        stageSequence: index,
        stageUnlocked,
        unlockMode: (resource.unlockMode ?? "immediate") as UnlockMode,
        prerequisiteBindingId: resource.prerequisiteBindingId,
        requiredProgress: resource.requiredProgress,
        unlockAt: resource.unlockAt,
        displayLocations: resource.displayLocations,
        viaMembership: hasMembership && stageUnlocked
      };
      stagesByResource.set(key, [...(stagesByResource.get(key) ?? []), fact]);
    }
  });

  return { organizationId, userId, now, grantsByResource, stagesByResource, freeResources, hasMembership };
}

const NO_PROGRESS: ProgressFact = { progressPercent: 0, completedAt: null };

/**
 * Facts for one resource. prerequisiteProgress is empty for now: the only per-resource progress
 * this repo stores is academy_lesson_progress, which is keyed by lesson rather than by curriculum
 * binding, so after_resource and progress_gte evaluate to "not yet" until a reading-progress
 * source exists. The resolver implements both modes and is tested on them; this is the data gap,
 * stated rather than hidden.
 */
export function factsForResource(context: StudentAccessContext, key: ResourceKey, resourceStatus: "published" | "draft" | "archived" = "published"): ResourceAccessFacts {
  const id = resourceKey(key);
  return {
    resourceStatus,
    free: context.freeResources.has(id),
    grants: context.grantsByResource.get(id) ?? [],
    stages: context.stagesByResource.get(id) ?? [],
    prerequisiteProgress: {},
    progress: NO_PROGRESS,
    now: context.now
  };
}
