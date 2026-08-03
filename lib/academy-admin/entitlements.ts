import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
