import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { enqueueDocumentJob, listDocumentJobs, type DocumentJobType } from "@/lib/queue/document-queue";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/security/request-limits";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";
import { inputErrorResponse } from "@/lib/input/api-errors";
import { createInputTraceId, getInputRuntimePolicy, type InputFormat, type InputMode } from "@h2obook/input-core";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(); if (auth.response) return auth.response;
    const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
    const access = await resolveOrganizationAccess(auth.user!, organizationId);
    if (!access) throw new Error("WORKSPACE_FORBIDDEN");
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.from("document_jobs")
        .select("id,external_job_id,job_type,status,progress,input,output,error_message,created_at,updated_at")
        .eq("organization_id", access.organizationId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return NextResponse.json({ mode: "database", jobs: (data ?? []).map((item) => ({
        id: item.id, externalJobId: item.external_job_id, type: item.job_type, status: item.status, progress: item.progress,
        input: item.input, output: item.output, error: item.error_message, createdAt: item.created_at, updatedAt: item.updated_at,
      })) });
    }
    const jobs = (await listDocumentJobs()).filter((job) => job.organizationId === access.organizationId);
    return NextResponse.json({ mode: process.env.REDIS_URL ? "redis" : "memory", jobs });
  } catch (error) { return inputErrorResponse(error, request, "DOCUMENT_JOB_LIST_FAILED"); }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const limited = await rateLimit(requestIdentity(request, "document-job-create"), 60, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  let databaseJobId: string | undefined;
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> = null;
  try {
    const body = await readJsonBody<{ organizationId?: string; type?: DocumentJobType; input?: Record<string, unknown> }>(request, 3 * 1024 * 1024);
    if (!body.type) throw new Error("TYPE_REQUIRED");
    const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
    if (!access) throw new Error("WORKSPACE_FORBIDDEN");
    const scopedKeys = [body.input?.storageKey, body.input?.sourceKey, body.input?.assetKey].filter((value): value is string => typeof value === "string");
    if (scopedKeys.some((key) => !key.startsWith(`${access.organizationId}/`) || key.includes("..") || key.includes("\\"))) throw new Error("INVALID_STORAGE_SCOPE");

    supabase = await createSupabaseServerClient();
    const assetId = typeof body.input?.assetId === "string" ? body.input.assetId : undefined;
    if (supabase && assetId) {
      const { data: asset } = await supabase.from("assets").select("id,storage_key,status,quarantine_status")
        .eq("id", assetId).eq("organization_id", access.organizationId).is("deleted_at", null).maybeSingle();
      if (!asset) throw new Error("ASSET_NOT_FOUND");
      if (asset.status !== "ready" || asset.quarantine_status !== "clean") throw new Error(asset.quarantine_status === "blocked" ? "ASSET_SCAN_BLOCKED" : "ASSET_SCAN_PENDING");
      if (typeof body.input?.storageKey === "string" && body.input.storageKey !== asset.storage_key) throw new Error("ASSET_STORAGE_MISMATCH");
    }

    const inputSessionId = typeof body.input?.inputSessionId === "string" ? body.input.inputSessionId : undefined;
    let sessionTraceId = typeof body.input?.traceId === "string" ? body.input.traceId : createInputTraceId();
    if (supabase && inputSessionId) {
      const { data: session } = await supabase.from("input_sessions").select("id,trace_id,status,source_format,import_mode,cancellation_requested")
        .eq("id", inputSessionId).eq("organization_id", access.organizationId).maybeSingle();
      if (!session) throw new Error("INPUT_SESSION_NOT_FOUND");
      if (["completed", "cancelled"].includes(session.status) || session.cancellation_requested) throw new Error("INPUT_SESSION_IMMUTABLE");
      sessionTraceId = session.trace_id || sessionTraceId;
    }

    const format = String(body.input?.format ?? (body.type.startsWith("pdf") ? "pdf" : body.type === "docx_import" ? "docx" : body.type === "ocr" ? "png" : "txt")) as InputFormat;
    const mode = String(body.input?.mode ?? (body.type === "pdf_import" ? "fixed_layout" : body.type === "ocr" ? "ocr" : "editable_content")) as InputMode;
    const policy = getInputRuntimePolicy(format, mode);

    if (supabase) {
      const { data, error } = await supabase.from("document_jobs").insert({
        organization_id: access.organizationId, requested_by: auth.user!.id, job_type: body.type,
        status: "queued", progress: 0, input: { ...(body.input ?? {}), inputSessionId, traceId: sessionTraceId, format, mode },
      }).select("id").single();
      if (error) throw error;
      databaseJobId = data.id;
    }

    const jobInput = { ...(body.input ?? {}), databaseJobId, inputSessionId, traceId: sessionTraceId, format, mode, idempotencyKey: body.input?.idempotencyKey ?? databaseJobId ?? inputSessionId };
    const job = await enqueueDocumentJob({ organizationId: access.organizationId, type: body.type, input: jobInput });
    if (supabase && databaseJobId) await supabase.from("document_jobs").update({ external_job_id: job.id, updated_at: new Date().toISOString() }).eq("id", databaseJobId).eq("organization_id", access.organizationId);
    if (supabase && inputSessionId) await supabase.from("input_sessions").update({ status: "queued", external_job_id: job.id, trace_id: sessionTraceId, processing_deadline_at: new Date(Date.now() + policy.timeoutMs).toISOString(), heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", inputSessionId).eq("organization_id", access.organizationId);
    return NextResponse.json({ job: { ...job, databaseJobId }, traceId: sessionTraceId }, { status: 201, headers: { "x-trace-id": sessionTraceId } });
  } catch (error) {
    if (supabase && databaseJobId) await supabase.from("document_jobs").update({ status: "failed", error_message: error instanceof Error ? error.message : "QUEUE_FAILED", updated_at: new Date().toISOString() }).eq("id", databaseJobId);
    return inputErrorResponse(error, request, "QUEUE_FAILED");
  }
}
