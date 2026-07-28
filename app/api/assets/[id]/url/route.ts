import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDownloadUrl } from "@/lib/storage/r2";
import { isR2Configured } from "@/lib/runtime-config";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!isR2Configured()) return NextResponse.json({ url: null, mode: "demo" });
  const access = await resolveOrganizationAccess(auth.user!, new URL(request.url).searchParams.get("organizationId") ?? undefined);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await client.from("assets")
    .select("id,storage_key,original_name,status,quarantine_status")
    .eq("id", id).eq("organization_id", access.organizationId).is("deleted_at", null).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
  if (data.status !== "ready" || data.quarantine_status !== "clean") return NextResponse.json({ error: "ASSET_NOT_READY" }, { status: 423 });
  return NextResponse.json({ url: await createDownloadUrl(data.storage_key, data.original_name), expiresIn: 300 });
}
