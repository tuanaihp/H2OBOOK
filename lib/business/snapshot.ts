import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BusinessAccessSnapshot, BusinessFeature, CareerStage, CommercialPlan } from "./types";

// Best-effort mapping of a real membership's free-text plan_name (public.products.name, e.g.
// "Academy Pro", "Business White-label" — see app/membership/page.tsx's existing plan catalog)
// onto the fixed CommercialPlan vocabulary this module reasons about. Never fabricated: a
// membership with an unrecognized name still counts as active, just defaults to the narrowest
// real plan (membership_professional) rather than guessing something more permissive.
export function resolveCommercialPlan(planName: string): CommercialPlan {
  const normalized = planName.toLowerCase();
  if (normalized.includes("white")) return "white_label";
  if (normalized.includes("academy")) return "academy_pro";
  if (normalized.includes("business")) return "business_pro";
  if (normalized.includes("marketing")) return "membership_marketing";
  return "membership_professional";
}

// Stage 1 (public store) is always unlocked. Stage 2 unlocks on the first real signal of
// engagement (active membership, a completed course, or a published/approved Create Outcome
// project) — there is no per-user roadmap-stage table yet (see the integration report's
// Risks/TODO), so stages 3-6 are deliberately gated behind an explicit admin manual_grant
// (business_feature_grants, source_type='stage') rather than a guessed heuristic.
async function resolveUnlockedStages(admin: ReturnType<typeof createSupabaseAdminClient>, organizationId: string, userId: string, activeMembership: boolean, grantedStages: CareerStage[]): Promise<CareerStage[]> {
  const stages = new Set<CareerStage>([1, ...grantedStages]);
  if (activeMembership) {
    stages.add(2);
  } else {
    const { data } = await admin!.from("create_outcome_projects").select("id").eq("organization_id", organizationId).eq("owner_user_id", userId).in("status", ["approved", "published"]).limit(1);
    if (data?.length) stages.add(2);
  }
  return [...stages].sort((a, b) => a - b);
}

export async function getBusinessAccessSnapshot(userId: string, organizationId: string, role: string): Promise<BusinessAccessSnapshot | null> {
  if (role !== "student" && role !== "admin" && role !== "owner") return null;
  if (role === "admin" || role === "owner") {
    return { userId, organizationId, role, plan: "white_label", activeMembership: true, unlockedStages: [1, 2, 3, 4, 5, 6], purchasedFeatures: [], manualFeatures: [] };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const nowIso = new Date().toISOString();
  const [{ data: membershipRow }, { data: grantRows }] = await Promise.all([
    admin.from("memberships").select("plan_name,status,expires_at").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("business_feature_grants").select("feature_slug,source_type").eq("organization_id", organizationId).eq("user_id", userId).is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  ]);

  const activeMembership = Boolean(membershipRow && (!membershipRow.expires_at || new Date(membershipRow.expires_at) > new Date()));
  const plan: CommercialPlan = activeMembership ? resolveCommercialPlan(String(membershipRow!.plan_name)) : "basic";

  const purchasedFeatures: BusinessFeature[] = [];
  const manualFeatures: BusinessFeature[] = [];
  const grantedStages: CareerStage[] = [];
  for (const row of grantRows ?? []) {
    const slug = String(row.feature_slug);
    if (row.source_type === "purchase") purchasedFeatures.push(slug as BusinessFeature);
    else if (row.source_type === "manual_grant") manualFeatures.push(slug as BusinessFeature);
    else if (row.source_type === "stage") {
      const stageNumber = Number(slug);
      if (stageNumber >= 1 && stageNumber <= 6) grantedStages.push(stageNumber as CareerStage);
    }
  }

  const unlockedStages = await resolveUnlockedStages(admin, organizationId, userId, activeMembership, grantedStages);

  return { userId, organizationId, role: "student", plan, activeMembership, unlockedStages, purchasedFeatures, manualFeatures };
}
