import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isR2Configured } from "@/lib/runtime-config";
import { requestIdentity, rateLimit } from "@/lib/security/rate-limit";
import { validateMagicBytes, validateUpload } from "@/lib/security/uploads";
import { checkStorageQuota } from "@/lib/storage/quota";
import { uploadStoredObject } from "@/lib/storage/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PROXY_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const limit = await rateLimit(requestIdentity(request, "upload-proxy"), 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const key = request.headers.get("x-h2obook-storage-key")?.trim() ?? "";
  const mimeType = request.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "";
  const sizeBytes = Number(request.headers.get("x-h2obook-size"));
  const organizationId = request.headers.get("x-h2obook-organization-id")?.trim() || undefined;
  let fileName = "";
  try { fileName = decodeURIComponent(request.headers.get("x-h2obook-file-name") ?? ""); }
  catch { return NextResponse.json({ error: "UPLOAD_FILE_NAME_INVALID" }, { status: 400 }); }

  if (!key || !fileName || !Number.isSafeInteger(sizeBytes)) {
    return NextResponse.json({ error: "UPLOAD_METADATA_REQUIRED" }, { status: 400 });
  }
  if (sizeBytes > MAX_PROXY_BYTES) {
    return NextResponse.json({ error: "UPLOAD_PROXY_LIMIT_EXCEEDED", message: "Ảnh vượt giới hạn upload dự phòng 4 MB; cần dùng kết nối trực tiếp R2." }, { status: 413 });
  }
  const valid = validateUpload({ fileName, mimeType, sizeBytes });
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, organizationId, ["owner", "admin", "designer", "partner", "teacher", "student"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  if (!key.startsWith(`${access.organizationId}/`)) return NextResponse.json({ error: "INVALID_STORAGE_SCOPE" }, { status: 403 });
  if (!isR2Configured()) return NextResponse.json({ error: "R2_NOT_CONFIGURED" }, { status: 503 });

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROXY_BYTES) {
    return NextResponse.json({ error: "UPLOAD_PROXY_LIMIT_EXCEEDED" }, { status: 413 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength !== sizeBytes) return NextResponse.json({ error: "UPLOADED_OBJECT_MISMATCH" }, { status: 400 });
  const magic = validateMagicBytes(mimeType, bytes.subarray(0, 4096));
  if (!magic.ok) return NextResponse.json({ error: magic.error }, { status: 400 });

  if (access.role === "student") {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const quota = await checkStorageQuota(supabase, access.organizationId, auth.user!.id, access.role, sizeBytes);
      if (!quota.ok) return NextResponse.json({ error: "STORAGE_QUOTA_EXCEEDED", usedBytes: quota.usedBytes, limitBytes: quota.limitBytes }, { status: 413 });
    }
  }

  try {
    await uploadStoredObject({ key, contentType: mimeType, body: bytes });
    return NextResponse.json({ ok: true, key });
  } catch {
    return NextResponse.json({ error: "R2_UPLOAD_FAILED" }, { status: 502 });
  }
}
