import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readStoredObject } from "@/lib/storage/r2";
import { decodeHtmlBytes, parseHtmlImport } from "@/lib/input/html-import.server";
import { safeFetchDocument } from "@/lib/ingestion/safe-fetch";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";
import { validateMagicBytes, validateUpload } from "@/lib/security/uploads";

export const runtime = "nodejs";
const MAX_HTML_BYTES = Math.min(20_000_000, Math.max(100_000, Number(process.env.MAX_HTML_IMPORT_BYTES ?? 5_000_000)));

function normalizedMime(fileName: string, mimeType?: string) {
  if (mimeType === "application/xhtml+xml") return mimeType;
  if (mimeType === "text/html") return mimeType;
  if (/\.xhtml$/i.test(fileName)) return "application/xhtml+xml";
  return "text/html";
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const limited = await rateLimit(requestIdentity(request, "html-import-preview"), 20, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const bookId = String(form.get("bookId") ?? crypto.randomUUID());
      const organizationId = String(form.get("organizationId") ?? "") || undefined;
      if (!(file instanceof File)) return NextResponse.json({ error: "HTML_FILE_REQUIRED" }, { status: 400 });
      const access = await resolveOrganizationAccess(auth.user!, organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
      if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
      if (file.size > MAX_HTML_BYTES) return NextResponse.json({ error: "HTML_SOURCE_TOO_LARGE" }, { status: 413 });
      const mimeType = normalizedMime(file.name, file.type);
      const valid = validateUpload({ fileName: file.name, mimeType, sizeBytes: file.size });
      if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const magic = validateMagicBytes(mimeType, bytes.slice(0, 4096));
      if (!magic.ok) return NextResponse.json({ error: magic.error }, { status: 400 });
      const decoded = decodeHtmlBytes(bytes, mimeType);
      const result = parseHtmlImport({ html: decoded.html, sourceFileName: valid.safeName, bookId, organizationId: access.organizationId, contentType: mimeType, charset: decoded.charset });
      return NextResponse.json({ result, mode: "direct-file" });
    }

    const body = await request.json().catch(() => null) as { organizationId?: string; bookId?: string; assetId?: string; url?: string; sourceFileName?: string } | null;
    if (!body?.bookId || (!body.assetId && !body.url)) return NextResponse.json({ error: "HTML_SOURCE_REQUIRED" }, { status: 400 });
    const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
    if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });

    if (body.url) {
      const fetched = await safeFetchDocument(body.url);
      if (!["text/html", "application/xhtml+xml"].includes(fetched.contentType)) return NextResponse.json({ error: "HTML_CONTENT_TYPE_REQUIRED" }, { status: 400 });
      const result = parseHtmlImport({
        html: fetched.body, sourceFileName: body.sourceFileName || new URL(fetched.url).pathname.split("/").pop() || "web-page.html",
        bookId: body.bookId, organizationId: access.organizationId, sourceUrl: body.url, finalUrl: fetched.url,
        contentType: fetched.contentType, charset: fetched.charset, title: fetched.title,
      });
      return NextResponse.json({ result, mode: "url", finalUrl: fetched.url });
    }

    const client = await createSupabaseServerClient();
    if (!client) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
    const { data: asset } = await client.from("assets")
      .select("id,storage_key,original_name,mime_type,size_bytes,status,quarantine_status")
      .eq("id", body.assetId!).eq("organization_id", access.organizationId).is("deleted_at", null).maybeSingle();
    if (!asset) return NextResponse.json({ error: "HTML_ASSET_NOT_FOUND" }, { status: 404 });
    if (asset.status !== "ready" || asset.quarantine_status !== "clean") return NextResponse.json({ error: asset.quarantine_status === "blocked" ? "ASSET_SCAN_BLOCKED" : "ASSET_SCAN_PENDING" }, { status: 423 });
    if (Number(asset.size_bytes) > MAX_HTML_BYTES) return NextResponse.json({ error: "HTML_SOURCE_TOO_LARGE" }, { status: 413 });
    const bytes = await readStoredObject(asset.storage_key);
    const mimeType = normalizedMime(asset.original_name, asset.mime_type);
    const magic = validateMagicBytes(mimeType, bytes.slice(0, 4096));
    if (!magic.ok) return NextResponse.json({ error: magic.error }, { status: 400 });
    const decoded = decodeHtmlBytes(bytes, asset.mime_type);
    const result = parseHtmlImport({ html: decoded.html, sourceFileName: asset.original_name, bookId: body.bookId, organizationId: access.organizationId, contentType: mimeType, charset: decoded.charset });
    result.metadata.sourceAssetId = asset.id;
    return NextResponse.json({ result, mode: "cloud-asset" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "HTML_IMPORT_FAILED" }, { status: 400 });
  }
}
