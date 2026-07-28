import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDownloadUrl, headStoredObject } from "@/lib/storage/r2";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { organizationId?: string; sourceAssetId?: string; assets?: Array<{ assetId?: string; storageKey?: string; fileName?: string; mimeType?: string }> } | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const inputs = (body?.assets ?? []).slice(0, 500);
  if (inputs.some((asset) => !asset.storageKey?.startsWith(`${access.organizationId}/`) || asset.storageKey.includes(".."))) return NextResponse.json({ error: "INVALID_STORAGE_SCOPE" }, { status: 403 });
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  if (body?.sourceAssetId) {
    const { data: source } = await client.from("assets").select("id,status,quarantine_status").eq("id", body.sourceAssetId).eq("organization_id", access.organizationId).is("deleted_at", null).maybeSingle();
    if (!source) return NextResponse.json({ error: "SOURCE_ASSET_NOT_FOUND" }, { status: 404 });
    if (source.status !== "ready" || source.quarantine_status !== "clean") return NextResponse.json({ error: source.quarantine_status === "blocked" ? "ASSET_SCAN_BLOCKED" : "ASSET_SCAN_PENDING" }, { status: 423 });
  }
  const output: Array<{ sourceAssetId?: string; assetId: string; storageKey: string; previewUrl: string; fileName: string; mimeType: string }> = [];
  for (const input of inputs) {
    if (!input.storageKey) continue;
    const existing = await client.from("assets").select("id,storage_key,original_name,mime_type").eq("organization_id", access.organizationId).eq("storage_key", input.storageKey).maybeSingle();
    let row = existing.data;
    if (!row) {
      const stored = await headStoredObject(input.storageKey);
      const inserted = await client.from("assets").insert({
        organization_id: access.organizationId,
        uploaded_by: auth.user!.id,
        asset_type: "pdf-extracted-image",
        original_name: input.fileName || input.storageKey.split("/").pop() || "pdf-image",
        storage_key: input.storageKey,
        mime_type: input.mimeType || stored.contentType,
        size_bytes: stored.sizeBytes,
        status: "ready",
        quarantine_status: "clean",
        metadata: { generatedBy: "pdf-reconstruct-worker", sourceAssetId: input.assetId ?? null },
      }).select("id,storage_key,original_name,mime_type").single();
      if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });
      row = inserted.data;
    }
    output.push({
      sourceAssetId: input.assetId,
      assetId: row.id,
      storageKey: row.storage_key,
      fileName: row.original_name,
      mimeType: row.mime_type,
      previewUrl: await createDownloadUrl(row.storage_key),
    });
  }
  return NextResponse.json({ assets: output });
}
