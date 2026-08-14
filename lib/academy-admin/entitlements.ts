import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { grantAcademyAccess } from "@/lib/academy/service";
import { membershipPlans } from "@/lib/public-site/content";
import type { AcademyAdminAccess } from "./types";

export interface StudentLookupResult { id: string; name: string; email: string }

export async function findStudentByEmail(access: AcademyAdminAccess, email: string): Promise<StudentLookupResult | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("profiles").select("id,full_name,email,organization_members!inner(organization_id)").eq("organization_members.organization_id", access.organizationId).ilike("email", email.trim().toLowerCase()).maybeSingle();
  if (!data) return null;
  return { id: String(data.id), name: String(data.full_name || "Học viên"), email: String(data.email ?? "") };
}

export interface ManualGrantInput {
  userId: string;
  resourceType: "course" | "roadmap" | "book" | "template";
  resourceId: string;
  expiresAt?: string;
  reason: string;
}

// Manual grant (CLAUDE_MAIN_INTEGRATION_PROMPT.md Phase 8): user, resource, start date, expiry,
// reason and granting actor are all captured; the entitlements_domain_event trigger (migration
// 0031) provides the audit event automatically on insert.
export async function grantManualEntitlement(access: AcademyAdminAccess, input: ManualGrantInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { data, error } = await supabase.from("entitlements").insert({
    user_id: input.userId,
    organization_id: access.organizationId,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    permission: "access",
    source_type: "manual",
    source_id: null,
    starts_at: new Date().toISOString(),
    expires_at: input.expiresAt ?? null,
    status: "active",
    reason: input.reason,
    granted_by: access.userId
  }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "GRANT_CREATE_FAILED" };
  return { ok: true as const, id: String(data.id) };
}

export interface EntitlementGrantRow { id: string; userId: string; userName: string; resourceType: string; resourceId: string; status: string; startsAt: string; expiresAt: string | null; reason: string | null; sourceType: string }

export async function listManualGrants(access: AcademyAdminAccess, resourceType?: string, resourceId?: string): Promise<EntitlementGrantRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase.from("entitlements").select("id,user_id,resource_type,resource_id,status,starts_at,expires_at,reason,source_type,profiles(full_name)").eq("organization_id", access.organizationId).eq("source_type", "manual").order("starts_at", { ascending: false }).limit(50);
  if (resourceType) query = query.eq("resource_type", resourceType);
  if (resourceId) query = query.eq("resource_id", resourceId);
  const { data } = await query;
  return (data ?? []).map((row) => {
    const profileValue = row.profiles as unknown as Record<string, unknown> | Record<string, unknown>[] | null;
    const profile = Array.isArray(profileValue) ? profileValue[0] : profileValue;
    return {
      id: String(row.id), userId: String(row.user_id), userName: String(profile?.full_name ?? "Học viên"),
      resourceType: String(row.resource_type), resourceId: String(row.resource_id), status: String(row.status),
      startsAt: String(row.starts_at), expiresAt: row.expires_at ? String(row.expires_at) : null,
      reason: row.reason ? String(row.reason) : null, sourceType: String(row.source_type)
    };
  });
}

export async function revokeManualGrant(access: AcademyAdminAccess, grantId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("entitlements").update({ status: "revoked" }).eq("id", grantId).eq("organization_id", access.organizationId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/**
 * Grant Stage access (2026-08-14) — the exact gap docs/mission-workspace-v2 and every stage-gated
 * feature this session assumed would eventually be filled in: lib/student/stage-access.ts's
 * getUnlockedStageIds() has read `business_feature_grants` (source_type='manual_grant',
 * feature_slug=career_stages.slug) since migration 0030/0033, but nothing ever wrote to it — no
 * admin screen existed. Reusing that exact table/shape rather than inventing a new one. Additive by
 * construction (a Set the reader only ever .add()s to) — granting a new Stage can never remove
 * access to a Stage granted earlier; nothing here changes that.
 */
export interface StageGrantInput { userId: string; stageSlug: string; expiresAt?: string; reason: string }

export async function grantManualStageAccess(access: AcademyAdminAccess, input: StageGrantInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { data, error } = await supabase.from("business_feature_grants").upsert({
    organization_id: access.organizationId,
    user_id: input.userId,
    feature_slug: input.stageSlug,
    source_type: "manual_grant",
    source_id: null,
    starts_at: new Date().toISOString(),
    expires_at: input.expiresAt ?? null,
    revoked_at: null,
    created_by: access.userId
  }, { onConflict: "organization_id,user_id,feature_slug,source_type,source_id" }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "STAGE_GRANT_FAILED" };
  return { ok: true as const, id: String(data.id) };
}

export interface StageGrantRow { id: string; userId: string; userName: string; stageSlug: string; stageTitle: string; active: boolean; expiresAt: string | null; createdAt: string }

export async function listManualStageGrants(access: AcademyAdminAccess): Promise<StageGrantRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const [{ data: grants }, { data: stages }] = await Promise.all([
    supabase.from("business_feature_grants").select("id,user_id,feature_slug,expires_at,revoked_at,created_at,profiles(full_name)").eq("organization_id", access.organizationId).eq("source_type", "manual_grant").order("created_at", { ascending: false }).limit(50),
    supabase.from("career_stages").select("slug,title").eq("organization_id", access.organizationId)
  ]);
  const stageTitleBySlug = new Map(((stages ?? []) as { slug: string; title: string }[]).map((s) => [s.slug, s.title]));
  const now = Date.now();
  return ((grants ?? []) as { id: string; user_id: string; feature_slug: string; expires_at: string | null; revoked_at: string | null; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null }[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const active = !row.revoked_at && (!row.expires_at || new Date(row.expires_at).getTime() > now);
    return { id: String(row.id), userId: String(row.user_id), userName: String(profile?.full_name ?? "Học viên"), stageSlug: row.feature_slug, stageTitle: stageTitleBySlug.get(row.feature_slug) ?? row.feature_slug, active, expiresAt: row.expires_at, createdAt: row.created_at };
  });
}

export async function revokeManualStageGrant(access: AcademyAdminAccess, grantId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("business_feature_grants").update({ revoked_at: new Date().toISOString() }).eq("id", grantId).eq("organization_id", access.organizationId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/**
 * Grant Membership (2026-08-14) — real plans from lib/public-site/content.ts's membershipPlans
 * (the same catalog the self-serve invite flow already resolves through ensureAcademyCatalogProduct
 * inside grantAcademyAccess — not a second, invented plan list). Confirmed with the user: a manual
 * Admin grant here is `status: "active"` — immediate, real access (permanent unless an expiry is
 * set) — never the self-serve invite flow's 7-day trial, since an Admin who explicitly decided to
 * grant membership (VIP/đối tác/hỗ trợ sự cố) already made the call; defaulting to a trial would let
 * that access silently lapse with nobody watching for it.
 */
export const MEMBERSHIP_PLAN_OPTIONS = membershipPlans.map((plan) => ({ slug: plan.id, name: plan.name }));

export async function grantManualMembership(access: AcademyAdminAccess, input: { userId: string; planSlug: string; expiresAt?: string; reason: string }) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false as const, error: "SUPABASE_ADMIN_NOT_CONFIGURED" };
  if (!membershipPlans.some((plan) => plan.id === input.planSlug)) return { ok: false as const, error: "PLAN_NOT_FOUND" };
  try {
    await grantAcademyAccess(admin, {
      organizationId: access.organizationId,
      userId: input.userId,
      targetType: "membership",
      targetSlug: input.planSlug,
      sourceType: "manual_grant",
      sourceId: null,
      membershipGrant: { status: "active", expiresAt: input.expiresAt ?? null }
    });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "MEMBERSHIP_GRANT_FAILED" };
  }
}
