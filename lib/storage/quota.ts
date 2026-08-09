import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export const DEFAULT_STUDENT_STORAGE_QUOTA_BYTES = 300 * 1024 * 1024;

export async function resolveStorageQuotaBytes(supabase: SupabaseServerClient, organizationId: string, userId: string, role: string): Promise<number | null> {
  if (role !== "student") return null;
  const { data } = await supabase.from("organization_members").select("storage_quota_bytes").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  const override = data?.storage_quota_bytes;
  return typeof override === "number" && override > 0 ? override : DEFAULT_STUDENT_STORAGE_QUOTA_BYTES;
}

/**
 * Summed by Postgres, not by this process. The previous version selected size_bytes for every asset
 * the user owned and reduced the array here, which grew with the user's library on every upload and,
 * worse, would fail open if the row set were ever truncated in transit: a short array sums to less
 * than the truth, and this number decides whether an upload is allowed.
 *
 * Falls back to the old client-side sum when the RPC is missing, so a deployment that lands before
 * migration 0048 still enforces the quota rather than letting every upload through.
 */
export async function getStorageUsageBytes(supabase: SupabaseServerClient, organizationId: string, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("asset_storage_used_bytes", {
    p_organization_id: organizationId,
    p_user_id: userId
  });
  if (!error && data !== null && data !== undefined) return Number(data) || 0;

  const fallback = await supabase.from("assets").select("size_bytes").eq("organization_id", organizationId).eq("uploaded_by", userId).is("deleted_at", null);
  if (fallback.error || !fallback.data) return 0;
  return fallback.data.reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0);
}

export async function checkStorageQuota(supabase: SupabaseServerClient, organizationId: string, userId: string, role: string, incomingBytes: number) {
  const limitBytes = await resolveStorageQuotaBytes(supabase, organizationId, userId, role);
  if (limitBytes === null) return { ok: true, usedBytes: 0, limitBytes: null } as const;
  const usedBytes = await getStorageUsageBytes(supabase, organizationId, userId);
  return { ok: usedBytes + incomingBytes <= limitBytes, usedBytes, limitBytes } as const;
}
