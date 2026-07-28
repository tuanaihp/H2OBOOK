import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDownloadUrl, headStoredObject, readStoredObjectPrefix } from "@/lib/storage/r2";
import { validateMagicBytes } from "@/lib/security/uploads";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json() as {
    organizationId?: string;
    sourceAssetId?: string;
    variantType?: "thumbnail" | "preview" | "crop" | "print";
    storageKey?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    metadata?: Record<string, unknown>;
  };
  if (!body.sourceAssetId || !body.variantType || !body.storageKey || !body.mimeType) {
    return NextResponse.json({ error: "IMAGE_VARIANT_METADATA_REQUIRED" }, { status: 400 });
  }
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner","admin","designer","partner","teacher"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  if (!body.storageKey.startsWith(`${access.organizationId}/`) || body.storageKey.includes("..")) {
    return NextResponse.json({ error: "INVALID_STORAGE_SCOPE" }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data: source } = await supabase.from("assets").select("id,status,quarantine_status")
    .eq("id", body.sourceAssetId).eq("organization_id", access.organizationId).is("deleted_at", null).maybeSingle();
  if (!source) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
  if (source.status !== "ready" || source.quarantine_status !== "clean") {
    return NextResponse.json({ error: source.quarantine_status === "blocked" ? "ASSET_SCAN_BLOCKED" : "ASSET_SCAN_PENDING" }, { status: 423 });
  }
  const stored = await headStoredObject(body.storageKey).catch(() => null);
  if (!stored) return NextResponse.json({ error: "VARIANT_OBJECT_NOT_FOUND" }, { status: 404 });
  if (stored.contentType !== body.mimeType) return NextResponse.json({ error: "VARIANT_MIME_MISMATCH" }, { status: 400 });
  const prefix = await readStoredObjectPrefix(body.storageKey, 4096);
  const magic = validateMagicBytes(body.mimeType, prefix);
  if (!magic.ok) return NextResponse.json({ error: magic.error }, { status: 400 });
  const { data, error } = await supabase.from("asset_variants").upsert({
    organization_id: access.organizationId,
    asset_id: body.sourceAssetId,
    variant_type: body.variantType,
    storage_key: body.storageKey,
    mime_type: body.mimeType,
    size_bytes: stored.sizeBytes,
    width: Number.isFinite(body.width) ? Math.round(body.width!) : null,
    height: Number.isFinite(body.height) ? Math.round(body.height!) : null,
    metadata: body.metadata ?? {},
  }, { onConflict: "storage_key" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const url = await createDownloadUrl(body.storageKey);
  return NextResponse.json({ variant: data, url });
}
