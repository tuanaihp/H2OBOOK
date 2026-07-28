import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { safeFetchBinary } from "@/lib/ingestion/safe-fetch";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";
import { sanitizeFileName, validateMagicBytes } from "@/lib/security/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const limited = await rateLimit(requestIdentity(request, "html-remote-asset"), 60, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json().catch(() => null) as { url?: string } | null;
  if (!body?.url) return NextResponse.json({ error: "ASSET_URL_REQUIRED" }, { status: 400 });
  try {
    const fetched = await safeFetchBinary(body.url, { maxBytes: 15_000_000, allowedMime: /^image\/(png|jpeg|webp|avif)$/i });
    const magic = validateMagicBytes(fetched.contentType, fetched.bytes.slice(0, 4096));
    if (!magic.ok) return NextResponse.json({ error: magic.error }, { status: 400 });
    const extension = fetched.contentType === "image/png" ? "png" : fetched.contentType === "image/webp" ? "webp" : fetched.contentType === "image/avif" ? "avif" : "jpg";
    const allowedExtensions = extension === "jpg" ? ["jpg", "jpeg", "jpe"] : [extension];
    const sourceName = fetched.fileName || "remote-image";
    const currentExtension = sourceName.split(".").pop()?.toLowerCase() ?? "";
    const baseName = sourceName.replace(/\.[^.]+$/, "") || "remote-image";
    const candidate = allowedExtensions.includes(currentExtension) ? sourceName : `${baseName}.${extension}`;
    const fileName = sanitizeFileName(candidate);
    return new Response(fetched.bytes, {
      headers: {
        "content-type": fetched.contentType,
        "content-length": String(fetched.bytes.byteLength),
        "content-disposition": `attachment; filename="${fileName}"`,
        "x-h2obook-source-url": fetched.url,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "HTML_ASSET_FETCH_FAILED" }, { status: 400 });
  }
}
