import { NextResponse } from "next/server";
import { resolveSystemAccess } from "@/lib/system/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStorageHealth } from "@/lib/storage/usage";

// Real per-organization storage usage for the Admin dashboard banner. Admin/owner only.
export async function GET(request: Request) {
  const { access, response } = await resolveSystemAccess(request);
  if (response) return response;
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const storage = await getStorageHealth(admin, access!.organizationId);
  return NextResponse.json({ storage });
}
