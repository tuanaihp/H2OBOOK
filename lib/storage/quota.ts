import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export const DEFAULT_STUDENT_STORAGE_QUOTA_BYTES = 300 * 1024 * 1024;

export async function resolveStorageQuotaBytes(supabase: SupabaseServerClient, organizationId: string, userId: string, role: string): Promise<number | null> {
  if (role !== "student") return null;
  const { data } = await supabase.from("organization_members").select("storage_quota_bytes").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  const override = data?.storage_quota_bytes;
  return typeof override === "number" && override > 0 ? override : DEFAULT_STUDENT_STORAGE_QUOTA_BYTES;
}

export async function getStorageUsageBytes(supabase: SupabaseServerClient, organizationId: string, userId: string): Promise<number> {
  const { data, error } = await supabase.from("assets").select("size_bytes").eq("organization_id", organizationId).eq("uploaded_by", userId);
  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0);
}

export async function checkStorageQuota(supabase: SupabaseServerClient, organizationId: string, userId: string, role: string, incomingBytes: number) {
  const limitBytes = await resolveStorageQuotaBytes(supabase, organizationId, userId, role);
  if (limitBytes === null) return { ok: true, usedBytes: 0, limitBytes: null } as const;
  const usedBytes = await getStorageUsageBytes(supabase, organizationId, userId);
  return { ok: usedBytes + incomingBytes <= limitBytes, usedBytes, limitBytes } as const;
}
