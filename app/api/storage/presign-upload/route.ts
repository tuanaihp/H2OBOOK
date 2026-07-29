import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { requestIdentity, rateLimit } from "@/lib/security/rate-limit";
import { validateUpload } from "@/lib/security/uploads";
import { createUploadUrl, storageKey } from "@/lib/storage/r2";
import { isR2Configured } from "@/lib/runtime-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkStorageQuota } from "@/lib/storage/quota";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const limit = await rateLimit(requestIdentity(request, "upload"), 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json() as { fileName: string; mimeType: string; sizeBytes: number; organizationId?: string; category?: string };
  const valid = validateUpload(body);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner", "teacher", "student"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const organizationId = access.organizationId;
  const key = storageKey(organizationId, body.category || "assets", valid.safeName);
  if (!isR2Configured()) return NextResponse.json({ mode: "demo", key, uploadUrl: null, message: "R2 chưa cấu hình. Metadata upload đã được kiểm tra." });
  if (access.role === "student") {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const quota = await checkStorageQuota(supabase, organizationId, auth.user!.id, access.role, body.sizeBytes);
      if (!quota.ok) return NextResponse.json({ error: "STORAGE_QUOTA_EXCEEDED", usedBytes: quota.usedBytes, limitBytes: quota.limitBytes }, { status: 413 });
    }
  }
  const uploadUrl = await createUploadUrl({ key, contentType: body.mimeType, sizeBytes: body.sizeBytes });
  return NextResponse.json({ mode: "cloud", key, uploadUrl, expiresIn: 600 });
}
