import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enqueueDocumentJob } from "@/lib/queue/document-queue";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { organizationId?: string; assetId?: string; bookId?: string; title?: string } | null;
  if (!body?.assetId || !body.bookId) return NextResponse.json({ error: "WORD_FALLBACK_INPUT_REQUIRED" }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data: asset, error } = await supabase.from("assets")
    .select("id,storage_key,mime_type,status,quarantine_status,original_name")
    .eq("id", body.assetId).eq("organization_id", access.organizationId).is("deleted_at", null).single();
  if (error || !asset) return NextResponse.json({ error: "WORD_SOURCE_ASSET_NOT_FOUND" }, { status: 404 });
  if (asset.status !== "ready" || asset.quarantine_status !== "clean") return NextResponse.json({ error: "WORD_SOURCE_NOT_CLEAN" }, { status: 409 });
  if (asset.mime_type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return NextResponse.json({ error: "WORD_SOURCE_MIME_INVALID" }, { status: 400 });
  const now = new Date().toISOString();
  const { data: databaseJob, error: jobError } = await supabase.from("document_jobs").insert({
    organization_id: access.organizationId, requested_by: auth.user!.id, job_type: "docx_import", status: "queued", progress: 0,
    input: { assetId: asset.id, storageKey: asset.storage_key, bookId: body.bookId, title: body.title || asset.original_name, engine: "python-docx-fallback-2.0" }, created_at: now, updated_at: now,
  }).select("id").single();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 400 });
  try {
    const job = await enqueueDocumentJob({ organizationId: access.organizationId, type: "docx_import", input: { databaseJobId: databaseJob.id, assetId: asset.id, storageKey: asset.storage_key, bookId: body.bookId, title: body.title || asset.original_name } });
    await supabase.from("document_jobs").update({ external_job_id: job.id, updated_at: new Date().toISOString() }).eq("id", databaseJob.id);
    return NextResponse.json({ job: { ...job, databaseJobId: databaseJob.id }, fallback: "python-docx-2.0" }, { status: 202 });
  } catch (queueError) {
    await supabase.from("document_jobs").update({ status: "failed", error_code: "WORD_FALLBACK_QUEUE_FAILED", error_message: queueError instanceof Error ? queueError.message : "QUEUE_FAILED", updated_at: new Date().toISOString() }).eq("id", databaseJob.id);
    return NextResponse.json({ error: queueError instanceof Error ? queueError.message : "QUEUE_FAILED" }, { status: 500 });
  }
}
