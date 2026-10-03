import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoredObjectStream } from "@/lib/storage/r2";
import { isR2Configured } from "@/lib/runtime-config";

// Same-origin inline bytes — LAST RESORT display path. Every byte here is billed serverless
// bandwidth, so the default render path is the presigned direct-R2 URL from /url?view=1. This
// route exists only for clients whose canvas load fails without a bucket CORS rule (Konva
// crossOrigin="anonymous"), and for presign-endpoint outages.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!isR2Configured()) return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  const { id } = await context.params;
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await client.from("assets")
    .select("id,organization_id,storage_key,mime_type,status,quarantine_status")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (error || !data?.storage_key) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
  // Resolve access against the asset's actual workspace. An <img> request cannot attach the
  // workspace header/query used by JSON APIs, and defaulting to the user's first organization
  // made valid images in a second workspace return 404.
  const access = await resolveOrganizationAccess(auth.user!, data.organization_id);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  if (data.status !== "ready" || data.quarantine_status === "blocked") return NextResponse.json({ error: "ASSET_NOT_READY" }, { status: 423 });
  const object = await getStoredObjectStream(data.storage_key).catch(() => null);
  if (!object) return NextResponse.json({ error: "ASSET_READ_FAILED" }, { status: 502 });
  const headers = new Headers({
    "content-type": data.mime_type || object.contentType,
    "content-disposition": "inline",
    // Storage keys embed a UUID and are never rewritten, so the bytes behind an asset id are
    // immutable — a long private cache keeps a 60-page image book from re-fetching on every pan.
    "cache-control": "private, max-age=86400, immutable"
  });
  if (object.contentLength) headers.set("content-length", String(object.contentLength));
  if (object.etag) headers.set("etag", object.etag);
  return new Response(object.stream, { headers });
}
