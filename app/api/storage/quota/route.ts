import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUsageBytes, resolveStorageQuotaBytes } from "@/lib/storage/quota";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const access = await resolveOrganizationAccess(auth.user!, url.searchParams.get("organizationId") ?? undefined);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ usedBytes: 0, limitBytes: null, role: access.role });
  const [usedBytes, limitBytes] = await Promise.all([
    getStorageUsageBytes(supabase, access.organizationId, auth.user!.id),
    resolveStorageQuotaBytes(supabase, access.organizationId, auth.user!.id, access.role)
  ]);
  return NextResponse.json({ usedBytes, limitBytes, role: access.role });
}
