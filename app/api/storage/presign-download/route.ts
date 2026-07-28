import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createDownloadUrl } from "@/lib/storage/r2";
import { isR2Configured } from "@/lib/runtime-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json() as { assetId?: string; key?: string; fileName?: string; organizationId?: string };
  if (!isR2Configured()) return NextResponse.json({ mode: "demo", url: null, message: "R2 chưa cấu hình." });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  let query = supabase.from("assets").select("id,organization_id,storage_key,original_name,quarantine_status,status,deleted_at").eq("organization_id", access.organizationId).is("deleted_at", null);
  query = body.assetId ? query.eq("id", body.assetId) : body.key ? query.eq("storage_key", body.key) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  const { data: asset, error } = await query.maybeSingle();
  if (error || !asset) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
  if (asset.quarantine_status !== "clean" || asset.status !== "ready") return NextResponse.json({ error: "ASSET_NOT_CLEARED", status: asset.quarantine_status }, { status: 423 });
  return NextResponse.json({ mode: "cloud", url: await createDownloadUrl(asset.storage_key, body.fileName ?? asset.original_name), expiresIn: 300 });
}
