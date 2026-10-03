import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDownloadUrl, createViewUrl } from "@/lib/storage/r2";
import { isR2Configured } from "@/lib/runtime-config";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!isR2Configured()) return NextResponse.json({ url: null, mode: "demo" });
  const searchParams = new URL(request.url).searchParams;
  const { id } = await context.params;
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  // Look the asset up first, then authorize against ITS workspace — an <img> load cannot carry
  // the organizationId query JSON APIs use, and defaulting to the caller's first organization
  // made valid images in a second workspace return 404.
  const { data, error } = await client.from("assets")
    .select("id,organization_id,storage_key,original_name,status,quarantine_status")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
  const access = await resolveOrganizationAccess(auth.user!, data.organization_id);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  // Serve anything that isn't explicitly malware/policy-blocked. "pending" = never scanned (no
  // scanner configured), not "unsafe" — blocking it would make every upload undisplayable.
  if (data.status !== "ready" || data.quarantine_status === "blocked") return NextResponse.json({ error: "ASSET_NOT_READY" }, { status: 423 });
  // view=1 → inline-disposition direct-R2 render URL (the default display path — keeps image
  // bytes off serverless bandwidth). Default stays attachment-disposition for "save file".
  const view = searchParams.get("view") === "1";
  return NextResponse.json({ url: view ? await createViewUrl(data.storage_key) : await createDownloadUrl(data.storage_key, data.original_name), expiresIn: view ? 21600 : 300 });
}
