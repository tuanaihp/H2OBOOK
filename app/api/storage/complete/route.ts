import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headStoredObject, readStoredObjectPrefix } from "@/lib/storage/r2";
import { isR2Configured } from "@/lib/runtime-config";
import { validateMagicBytes, validateUpload } from "@/lib/security/uploads";
import { scanStoredFile } from "@/lib/security/file-scan";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json() as { organizationId?: string; key?: string; fileName?: string; mimeType?: string; sizeBytes?: number; assetType?: string; metadata?: Record<string, unknown>; checksum?: string; width?: number; height?: number };
  if (!body.key || !body.fileName || !body.mimeType || !body.sizeBytes) return NextResponse.json({ error: "UPLOAD_METADATA_REQUIRED" }, { status: 400 });
  const valid = validateUpload({ fileName: body.fileName, mimeType: body.mimeType, sizeBytes: body.sizeBytes });
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  if (!body.key.startsWith(`${access.organizationId}/`)) return NextResponse.json({ error: "INVALID_STORAGE_SCOPE" }, { status: 403 });

  if (!isR2Configured()) return NextResponse.json({ mode: "demo", asset: { id: crypto.randomUUID(), organizationId: access.organizationId, ...body, status: "ready", quarantineStatus: "clean" } });
  let stored: { sizeBytes: number; contentType: string };
  try { stored = await headStoredObject(body.key); }
  catch { return NextResponse.json({ error: "UPLOADED_OBJECT_NOT_FOUND" }, { status: 404 }); }
  if (stored.sizeBytes !== body.sizeBytes || stored.contentType !== body.mimeType) return NextResponse.json({ error: "UPLOADED_OBJECT_MISMATCH" }, { status: 400 });
  const header = await readStoredObjectPrefix(body.key, 4096);
  const magic = validateMagicBytes(body.mimeType, header);
  if (!magic.ok) return NextResponse.json({ error: magic.error }, { status: 400 });

  const scan = await scanStoredFile({ key: body.key, fileName: body.fileName, mimeType: body.mimeType, sizeBytes: body.sizeBytes });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const status = scan.status === "clean" ? "ready" : scan.status === "blocked" ? "blocked" : "processing";
  const { data, error } = await supabase.from("assets").insert({
    organization_id: access.organizationId,
    uploaded_by: auth.user!.id,
    asset_type: body.assetType ?? "document",
    original_name: valid.safeName,
    storage_key: body.key,
    mime_type: body.mimeType,
    size_bytes: body.sizeBytes,
    status,
    quarantine_status: scan.status,
    width: Number.isFinite(body.width) ? Math.max(1, Math.round(body.width!)) : null,
    height: Number.isFinite(body.height) ? Math.max(1, Math.round(body.height!)) : null,
    checksum: body.checksum ?? null,
    metadata: { ...(body.metadata ?? {}), scanReason: scan.reason ?? null, verifiedObject: true }
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ mode: "cloud", asset: data, scan }, { status: scan.status === "blocked" ? 422 : 200 });
}
