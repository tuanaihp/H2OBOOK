import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headStoredObject, readStoredObjectPrefix } from "@/lib/storage/r2";
import { isR2Configured } from "@/lib/runtime-config";
import { validateMagicBytes, validateUpload } from "@/lib/security/uploads";
import { scanStoredFile } from "@/lib/security/file-scan";
import { checkStorageQuota } from "@/lib/storage/quota";
import { findDuplicateAsset, hashStoredObject } from "@/lib/storage/hash";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  // Callers may still send `checksum` (the Image Smart Import path does, for its own metadata trail —
  // see lib/input/image-import.ts) but it is no longer read here: this route now computes its own
  // hash from the object actually stored in R2, which is verifiable and covers every upload path
  // uniformly rather than only the one that happened to compute a client-side value.
  const body = await request.json() as { organizationId?: string; key?: string; fileName?: string; mimeType?: string; sizeBytes?: number; assetType?: string; metadata?: Record<string, unknown>; width?: number; height?: number };
  if (!body.key || !body.fileName || !body.mimeType || !body.sizeBytes) return NextResponse.json({ error: "UPLOAD_METADATA_REQUIRED" }, { status: 400 });
  const valid = validateUpload({ fileName: body.fileName, mimeType: body.mimeType, sizeBytes: body.sizeBytes });
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner", "teacher", "student"]);
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
  if (access.role === "student") {
    const quota = await checkStorageQuota(supabase, access.organizationId, auth.user!.id, access.role, stored.sizeBytes);
    if (!quota.ok) return NextResponse.json({ error: "STORAGE_QUOTA_EXCEEDED", usedBytes: quota.usedBytes, limitBytes: quota.limitBytes }, { status: 413 });
  }
  const status = scan.status === "clean" ? "ready" : scan.status === "blocked" ? "blocked" : "processing";

  // Computed server-side from the object actually sitting in R2, not trusted from the client — a
  // client-reported hash could not be verified without re-reading the object anyway, so there is no
  // cost to always computing it here instead. null (not a fabricated value) for anything over
  // HASHABLE_MAX_BYTES; those assets simply are not deduplicated.
  const checksum = await hashStoredObject(body.key, stored.sizeBytes).catch(() => null);
  const duplicate = checksum ? await findDuplicateAsset(supabase, access.organizationId, checksum).catch(() => null) : null;

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
    checksum,
    metadata: { ...(body.metadata ?? {}), scanReason: scan.reason ?? null, verifiedObject: true }
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // duplicate is advisory only: the new asset row is always created (a caller that ignores this field
  // sees exactly the response shape it always has), so nothing breaks for the callers that don't yet
  // check it. A future upload UI can use it to offer "reuse the existing file" instead of storing a
  // second copy of identical bytes.
  return NextResponse.json({ mode: "cloud", asset: data, scan, duplicate }, { status: scan.status === "blocked" ? 422 : 200 });
}
