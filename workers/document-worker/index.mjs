import { Worker } from "bullmq";
import IORedis from "ioredis";
import { createClient } from "@supabase/supabase-js";

if (!process.env.REDIS_URL) { console.error("REDIS_URL is required for the production document worker."); process.exit(1); }
if (!process.env.DOCUMENT_WORKER_URL) { console.error("DOCUMENT_WORKER_URL is required. Deploy services/document-processor first."); process.exit(1); }
if (!process.env.DOCUMENT_WORKER_SECRET) { console.error("DOCUMENT_WORKER_SECRET is required."); process.exit(1); }

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 10_000),
  commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 15_000),
});
const admin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const log = (level, event, data = {}) => {
  const safe = Object.fromEntries(Object.entries(data).filter(([key]) => !/(content|text|body|html|token|secret|authorization|document)/i.test(key)));
  const line = JSON.stringify({ timestamp: new Date().toISOString(), service: "h2obook-document-worker", level, event, ...safe });
  if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.log(line);
};

const databaseJobId = job => job.data?.input?.databaseJobId;
const inputSessionId = job => job.data?.input?.inputSessionId;
const traceId = job => job.data?.input?.traceId || `job_${String(job.id)}`;

async function updateDatabase(job, patch) {
  const id = databaseJobId(job);
  if (!admin || !id) return;
  const { error } = await admin.from("document_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", job.data.organizationId);
  if (error) log("warn", "document_job.update_failed", { traceId: traceId(job), jobId: String(job.id), errorCode: error.code });
}

async function updateInputSession(job, patch) {
  const id = inputSessionId(job);
  if (!admin || !id) return;
  const { error } = await admin.from("input_sessions").update({ ...patch, heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", job.data.organizationId).not("status", "in", "(completed,cancelled)");
  if (error) log("warn", "input_session.update_failed", { traceId: traceId(job), sessionId: id, jobId: String(job.id), errorCode: error.code });
}

async function addEvent(job, eventType, message, progress, metadata = {}) {
  const id = databaseJobId(job);
  if (admin && id) await admin.from("document_job_events").insert({ job_id: id, event_type: eventType, message, progress, metadata });
  const sessionId = inputSessionId(job);
  if (admin && sessionId) await admin.from("input_session_events").insert({
    organization_id: job.data.organizationId, session_id: sessionId, event_name: `worker.${eventType}`, status: eventType === "failed" ? "failed" : eventType === "completed" ? "preview" : "processing",
    progress, trace_id: traceId(job), payload: { jobId: String(job.id), jobType: job.name, ...metadata },
  });
}

async function cancellationRequested(job) {
  if (job.data?.cancellationRequested || job.data?.input?.cancellationRequested) return true;
  const sessionId = inputSessionId(job);
  if (!admin || !sessionId) return false;
  const { data } = await admin.from("input_sessions").select("status,cancellation_requested").eq("id", sessionId).eq("organization_id", job.data.organizationId).maybeSingle();
  return Boolean(data?.cancellation_requested || data?.status === "cancelled");
}

function previewFromResult(job, result) {
  const bookDocument = result?.bookDocument;
  if (!bookDocument) return null;
  const sourceFileName = String(job.data?.input?.fileName ?? job.data?.input?.title ?? `${job.name}-import`);
  const format = job.name === "docx_import" ? "docx" : job.name.startsWith("pdf") ? "pdf" : job.name === "ocr" ? String(job.data?.input?.format ?? "png") : "txt";
  return {
    format, sourceFileName, title: String(bookDocument.title ?? sourceFileName), document: bookDocument,
    nodes: Array.isArray(bookDocument.root) ? bookDocument.root : [], assets: Array.isArray(result.assets) ? result.assets : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    statistics: result.statistics ?? { nodes: 0, headings: 0, paragraphs: 0, lists: 0, tables: 0, images: 0, footnotes: 0, words: 0 },
    metadata: { ...(bookDocument.metadata ?? {}), workerJobId: String(job.id), processor: "python-service" },
  };
}

const worker = new Worker("h2obook-document", async (job) => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = Number(process.env.DOCUMENT_WORKER_TIMEOUT_MS ?? 45 * 60_000);
  const heartbeatMs = Number(process.env.DOCUMENT_WORKER_HEARTBEAT_MS ?? 15_000);
  const timeout = setTimeout(() => controller.abort(new Error("WORKER_TIMEOUT")), timeoutMs);
  const heartbeat = setInterval(async () => {
    if (await cancellationRequested(job)) controller.abort(new Error("JOB_CANCELLED"));
    await updateDatabase(job, { progress: typeof job.progress === "number" ? job.progress : 5 });
    await updateInputSession(job, { status: "processing", progress: Math.min(80, Number(job.progress ?? 5)), lease_owner: `document-worker:${process.pid}` });
  }, heartbeatMs);
  try {
    if (await cancellationRequested(job)) throw new Error("JOB_CANCELLED");
    await updateDatabase(job, { status: "processing", started_at: new Date().toISOString(), progress: 5, attempts: Number(job.attemptsMade ?? 0) + 1 });
    await updateInputSession(job, { status: "processing", progress: 5, external_job_id: String(job.id), lease_owner: `document-worker:${process.pid}`, trace_id: traceId(job) });
    await job.updateProgress(5);
    await addEvent(job, "started", `Bắt đầu ${job.name}`, 5, { attempt: Number(job.attemptsMade ?? 0) + 1 });
    log("info", "worker.job.started", { traceId: traceId(job), sessionId: inputSessionId(job), jobId: String(job.id), jobType: job.name, attempt: Number(job.attemptsMade ?? 0) + 1 });

    const processorInput = { ...(job.data?.input ?? {}) };
    delete processorInput.databaseJobId;
    delete processorInput.inputSessionId;
    delete processorInput.traceId;
    const response = await fetch(`${process.env.DOCUMENT_WORKER_URL.replace(/\/$/, "")}/process`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.DOCUMENT_WORKER_SECRET}`, "x-trace-id": traceId(job) },
      body: JSON.stringify({ jobId: String(job.id), organizationId: job.data.organizationId, type: job.name, input: processorInput }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`PROCESSOR_${response.status}`);
    if (await cancellationRequested(job)) throw new Error("JOB_CANCELLED");
    await job.updateProgress(90);
    await updateDatabase(job, { progress: 90 });
    await updateInputSession(job, { status: "processing", progress: 80 });
    const payload = await response.json();
    const result = { ...(payload.result ?? payload), completedAt: new Date().toISOString(), processor: "python-service" };
    const preview = previewFromResult(job, result);
    if (await cancellationRequested(job)) throw new Error("JOB_CANCELLED");
    await job.updateProgress(100);
    await updateDatabase(job, { status: "completed", progress: 100, output: result, completed_at: result.completedAt });
    if (preview) await updateInputSession(job, { status: "preview", progress: 85, preview_document: preview, warnings: preview.warnings, metrics: { durationMs: Date.now() - startedAt, nodeCount: preview.statistics?.nodes ?? 0, warningCount: preview.warnings.length }, lease_owner: null });
    else if (job.name === "pdf_import") await updateInputSession(job, { status: "preview", progress: 85, design_payload: { kind: "pdf-fixed-layout", pages: result.pages ?? [], pageCount: result.pageCount ?? 0 }, metrics: { durationMs: Date.now() - startedAt, pageCount: result.pageCount ?? 0 }, lease_owner: null });
    await addEvent(job, "completed", `${job.name} hoàn tất`, 100, { durationMs: Date.now() - startedAt, hasPreview: Boolean(preview) });
    log("info", "worker.job.completed", { traceId: traceId(job), sessionId: inputSessionId(job), jobId: String(job.id), jobType: job.name, durationMs: Date.now() - startedAt });
    return result;
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
  }
}, {
  connection,
  concurrency: Math.min(8, Math.max(1, Number(process.env.DOCUMENT_WORKER_CONCURRENCY ?? 2))),
  lockDuration: Number(process.env.DOCUMENT_WORKER_LOCK_MS ?? 20 * 60_000),
  stalledInterval: Number(process.env.DOCUMENT_WORKER_STALLED_INTERVAL_MS ?? 30_000),
  maxStalledCount: Math.min(3, Math.max(1, Number(process.env.DOCUMENT_WORKER_MAX_STALLED ?? 1))),
});

worker.on("completed", job => log("info", "worker.queue.completed", { traceId: traceId(job), jobId: String(job.id), jobType: job.name }));
worker.on("failed", async (job, error) => {
  if (!job) return;
  const cancelled = error.message === "JOB_CANCELLED" || await cancellationRequested(job);
  const code = cancelled ? "JOB_CANCELLED" : error.name === "AbortError" || error.message === "WORKER_TIMEOUT" ? "WORKER_TIMEOUT" : /^PROCESSOR_/.test(error.message) ? error.message : "WORKER_FAILED";
  log(cancelled ? "warn" : "error", "worker.job.failed", { traceId: traceId(job), sessionId: inputSessionId(job), jobId: String(job.id), jobType: job.name, errorCode: code, attempt: Number(job.attemptsMade ?? 0) });
  await updateDatabase(job, { status: cancelled ? "cancelled" : "failed", error_message: code, error_code: code });
  await updateInputSession(job, { status: cancelled ? "cancelled" : "failed", retryable: !cancelled && Number(job.attemptsMade ?? 0) < Number(process.env.DOCUMENT_JOB_ATTEMPTS ?? 3), last_error_code: code, last_error_message: cancelled ? "Job đã được hủy." : "Worker xử lý thất bại.", lease_owner: null });
  await addEvent(job, cancelled ? "cancelled" : "failed", code, Number(job.progress ?? 0), { errorCode: code, attempt: Number(job.attemptsMade ?? 0) });
});
worker.on("error", error => log("error", "worker.runtime.error", { errorCode: error?.code ?? error?.name ?? "WORKER_RUNTIME_ERROR" }));
log("info", "worker.started", { concurrency: Number(process.env.DOCUMENT_WORKER_CONCURRENCY ?? 2) });
const stop = async signal => {
  log("info", "worker.stopping", { signal });
  await worker.close(); await connection.quit(); process.exit(0);
};
process.on("SIGINT", () => void stop("SIGINT")); process.on("SIGTERM", () => void stop("SIGTERM"));
