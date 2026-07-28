import { createSupabaseServerClient } from "@/lib/supabase/server";
import { flattenContentNodes, nestContentNodes } from "@/lib/content-document";
import {
  appendImportAsChapter,
  applyInputCorrections,
  compactWarnings,
  computeRetryDelayMs,
  createInputTraceId,
  getInputRuntimePolicy,
  inputErrorCode,
  isRetryableInputError,
  createOrchestratedSession,
  inputStatusCanRetry,
  transitionInputSession,
  validateCorrections,
  validateDesignPayload,
  validateImportDocumentLimits,
  type InputCommitResult,
  type InputCorrection,
  type InputDestinationConfig,
  type InputMode,
  type InputSourceDescriptor,
  type OrchestratedInputSession,
} from "@h2obook/input-core";
import type { ImportDocument, InputFormat } from "@h2obook/input-core";
import type { BookDocument } from "@h2obook/content-core";
import { inputLog, logInputError, withInputTelemetry } from "@/lib/observability/input-observability";

const demoSessions = new Map<string, OrchestratedInputSession>();

function rowToSession(row: Record<string, unknown>): OrchestratedInputSession {
  const source = (row.source ?? {}) as InputSourceDescriptor;
  const destination = (row.destination ?? { type: "new_book" }) as InputDestinationConfig;
  const preview = row.preview_document as ImportDocument | undefined;
  return {
    id: String(row.id), schemaVersion: 1, organizationId: String(row.organization_id), bookId: row.target_book_id ? String(row.target_book_id) : undefined,
    sourceName: String(source.fileName ?? source.url ?? "Nguồn nhập"), mimeType: source.mimeType,
    format: String(row.source_format) as InputFormat, mode: String(row.import_mode) as InputMode,
    status: String(row.status) as OrchestratedInputSession["status"], idempotencyKey: String(row.idempotency_key),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), metadata: { ...((row.metadata ?? {}) as Record<string, unknown>), ...(row.design_payload ? { designPayload: row.design_payload } : {}), ...(row.external_job_id ? { externalJobId: row.external_job_id } : {}) },
    source, destination, attempt: Number(row.attempt ?? 0), progress: Number(row.progress ?? 0),
    stageMessage: typeof row.last_error_message === "string" ? row.last_error_message : undefined,
    preview, corrections: Array.isArray(row.corrections) ? row.corrections as InputCorrection[] : [],
    commitResult: row.commit_result as InputCommitResult | undefined, retryable: Boolean(row.retryable), cancellationRequested: Boolean(row.cancellation_requested),
    errorCode: typeof row.last_error_code === "string" ? row.last_error_code : undefined,
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : undefined,
    traceId: typeof row.trace_id === "string" ? row.trace_id : undefined,
    deadlineAt: typeof row.processing_deadline_at === "string" ? row.processing_deadline_at : undefined,
    heartbeatAt: typeof row.heartbeat_at === "string" ? row.heartbeat_at : undefined,
  };
}

export async function createInputSession(input: {
  organizationId: string;
  userId: string;
  sourceName: string;
  mimeType?: string;
  format: InputFormat;
  mode: InputMode;
  source: InputSourceDescriptor;
  destination: InputDestinationConfig;
  idempotencyKey?: string;
}) {
  const base = createOrchestratedSession(input);
  const traceId = createInputTraceId();
  const policy = getInputRuntimePolicy(input.format, input.mode);
  const client = await createSupabaseServerClient();
  if (!client) {
    const existing = [...demoSessions.values()].find((session) => session.organizationId === input.organizationId && session.idempotencyKey === base.idempotencyKey);
    if (existing) return { session: existing, duplicate: true, mode: "demo" as const };
    const session = transitionInputSession(base, "detected", { progress: 5, stageMessage: "Đã nhận dạng nguồn nhập." });
    demoSessions.set(session.id, session);
    return { session, duplicate: false, mode: "demo" as const };
  }
  const payload = {
    organization_id: input.organizationId, requested_by: input.userId, idempotency_key: base.idempotencyKey,
    source_format: base.format, import_mode: base.mode, status: "detected", progress: 5, source: base.source,
    destination: base.destination, target_book_id: base.destination.targetBookId && /^[0-9a-f-]{36}$/i.test(base.destination.targetBookId) ? base.destination.targetBookId : null,
    expected_document_version: base.destination.expectedDocumentVersion ?? null,
    metadata: {}, started_at: new Date().toISOString(), trace_id: traceId, heartbeat_at: new Date().toISOString(),
    processing_deadline_at: new Date(Date.now() + policy.timeoutMs).toISOString(), metrics: { format: input.format, mode: input.mode },
  };
  const { data, error } = await client.from("input_sessions").insert(payload).select("*").single();
  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await client.from("input_sessions").select("*").eq("organization_id", input.organizationId).eq("idempotency_key", base.idempotencyKey).single();
    if (existingError) throw existingError;
    return { session: rowToSession(existing), duplicate: true, mode: "database" as const };
  }
  if (error) throw error;
  await client.from("input_session_events").insert({ organization_id: input.organizationId, session_id: data.id, actor_id: input.userId, event_name: "session.created", status: "detected", progress: 5, trace_id: traceId, payload: { sourceKind: input.source.kind, sourceName: input.source.fileName ?? "url", destinationType: input.destination.type, format: input.format, mode: input.mode } });
  inputLog("info", { event: "input.session.created", traceId, sessionId: String(data.id), organizationId: input.organizationId, format: input.format, mode: input.mode });
  return { session: rowToSession(data), duplicate: false, mode: "database" as const };
}

export async function listInputSessions(organizationId: string, limit = 50) {
  const client = await createSupabaseServerClient();
  if (!client) return [...demoSessions.values()].filter((session) => session.organizationId === organizationId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  const { data, error } = await client.from("input_sessions").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw error;
  return (data ?? []).map(rowToSession);
}

export async function getInputSession(organizationId: string, sessionId: string) {
  const client = await createSupabaseServerClient();
  if (!client) {
    const session = demoSessions.get(sessionId);
    return session?.organizationId === organizationId ? session : null;
  }
  const { data, error } = await client.from("input_sessions").select("*").eq("id", sessionId).eq("organization_id", organizationId).maybeSingle();
  if (error) throw error;
  return data ? rowToSession(data) : null;
}

export async function updateInputSession(input: {
  organizationId: string;
  userId: string;
  sessionId: string;
  status?: OrchestratedInputSession["status"];
  progress?: number;
  stageMessage?: string;
  metadata?: Record<string, unknown>;
  externalJobId?: string;
  eventName?: string;
}) {
  const existing = await getInputSession(input.organizationId, input.sessionId);
  if (!existing) throw new Error("INPUT_SESSION_NOT_FOUND");
  const next = input.status ? transitionInputSession(existing, input.status, { progress: input.progress ?? existing.progress, stageMessage: input.stageMessage, metadata: { ...existing.metadata, ...(input.metadata ?? {}) } }) : { ...existing, progress: input.progress ?? existing.progress, stageMessage: input.stageMessage ?? existing.stageMessage, metadata: { ...existing.metadata, ...(input.metadata ?? {}) }, updatedAt: new Date().toISOString() };
  const client = await createSupabaseServerClient();
  if (!client) { demoSessions.set(next.id, next); return next; }
  const { data, error } = await client.from("input_sessions").update({
    status: next.status, progress: next.progress, metadata: next.metadata, external_job_id: input.externalJobId, heartbeat_at: new Date().toISOString(),
    last_error_message: next.status === "failed" || next.status === "recovery_required" ? next.stageMessage : null,
    updated_at: next.updatedAt,
  }).eq("id", next.id).eq("organization_id", input.organizationId).select("*").single();
  if (error) throw error;
  if (input.eventName) await client.from("input_session_events").insert({ organization_id: input.organizationId, session_id: next.id, actor_id: input.userId, event_name: input.eventName, status: next.status, progress: next.progress, payload: input.metadata ?? {} });
  return rowToSession(data);
}

export async function saveInputPreview(input: { organizationId: string; userId: string; sessionId: string; preview: ImportDocument; corrections?: InputCorrection[]; designPayload?: Record<string, unknown> }) {
  validateImportDocumentLimits(input.preview);
  validateCorrections(input.corrections ?? []);
  validateDesignPayload(input.designPayload);
  const existing = await getInputSession(input.organizationId, input.sessionId);
  if (!existing) throw new Error("INPUT_SESSION_NOT_FOUND");
  if (["completed", "cancelled"].includes(existing.status)) throw new Error("INPUT_SESSION_IMMUTABLE");
  if (!["processing", "preview", "correcting", "failed", "recovery_required"].includes(existing.status)) throw new Error("INPUT_SESSION_NOT_READY_FOR_PREVIEW");
  const blocking = input.preview.warnings.some((warning) => warning.severity === "error");
  const status = blocking ? "failed" : input.corrections?.length ? "correcting" : "preview";
  const client = await createSupabaseServerClient();
  if (!client) {
    const next = transitionInputSession(existing, status, { preview: input.preview, corrections: input.corrections ?? [], progress: blocking ? 80 : 85, retryable: true, errorCode: blocking ? "IMPORT_PREVIEW_BLOCKED" : undefined, metadata: { ...existing.metadata, ...(input.designPayload ? { designPayload: input.designPayload } : {}) } });
    demoSessions.set(next.id, next);
    return next;
  }
  const { data, error } = await client.from("input_sessions").update({
    status, progress: blocking ? 80 : 85, preview_document: input.preview, corrections: input.corrections ?? [], design_payload: input.designPayload ?? null,
    warnings: input.preview.warnings, retryable: true, last_error_code: blocking ? "IMPORT_PREVIEW_BLOCKED" : null,
    last_error_message: blocking ? "Preview có lỗi bắt buộc xử lý." : null, updated_at: new Date().toISOString(),
  }).eq("id", input.sessionId).eq("organization_id", input.organizationId).select("*").single();
  if (error) throw error;
  await client.from("input_session_events").insert({ organization_id: input.organizationId, session_id: input.sessionId, actor_id: input.userId, event_name: blocking ? "session.failed" : "session.preview_ready", status, progress: blocking ? 80 : 85, trace_id: existing.traceId, payload: { statistics: input.preview.statistics, warnings: compactWarnings(input.preview.warnings) } });
  return rowToSession(data);
}

async function loadExistingDocument(organizationId: string, targetBookId?: string, targetClientKey?: string) {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  let query = client.from("books").select("id,client_key,title").eq("organization_id", organizationId).is("deleted_at", null);
  query = targetBookId && /^[0-9a-f-]{36}$/i.test(targetBookId) ? query.eq("id", targetBookId) : query.eq("client_key", targetClientKey ?? targetBookId ?? "");
  const { data: book, error: bookError } = await query.maybeSingle();
  if (bookError) throw bookError;
  if (!book) return null;
  const { data: document, error } = await client.from("book_documents").select("*").eq("book_id", book.id).eq("organization_id", organizationId).maybeSingle();
  if (error) throw error;
  if (!document) return { book, document: null as BookDocument | null };
  const { data: nodes, error: nodeError } = await client.from("content_nodes").select("*").eq("document_id", document.id).order("position");
  if (nodeError) throw nodeError;
  return { book, document: { id: document.id, bookId: book.id, organizationId, title: document.title, language: document.language, root: nestContentNodes(nodes ?? []), metadata: document.metadata ?? {}, version: document.version, createdAt: document.created_at, updatedAt: document.updated_at } as BookDocument };
}

export async function commitInputSession(input: { organizationId: string; userId: string; sessionId: string; corrections?: InputCorrection[]; destination?: InputDestinationConfig }) {
  const session = await getInputSession(input.organizationId, input.sessionId);
  if (!session) throw new Error("INPUT_SESSION_NOT_FOUND");
  if (session.status === "completed" && session.commitResult) return session.commitResult;
  if (!session.preview && !(session.metadata.designPayload || false)) throw new Error("INPUT_PREVIEW_REQUIRED");
  const destination = input.destination ?? session.destination;
  validateCorrections(input.corrections ?? session.corrections);
  validateDesignPayload((session.metadata.designPayload ?? undefined) as Record<string, unknown> | undefined);
  let document = session.preview ? applyInputCorrections(session.preview.document, input.corrections ?? session.corrections) : undefined;
  let target = null;
  if (destination.type !== "new_book") {
    target = await loadExistingDocument(input.organizationId, destination.targetBookId, destination.targetClientKey);
    if (!target) throw new Error("BOOK_NOT_FOUND");
    if (destination.type === "append_chapter") {
      if (!document) throw new Error("INPUT_SEMANTIC_DOCUMENT_REQUIRED");
      document = target.document ? appendImportAsChapter(target.document, document, destination.chapterTitle) : { ...document, bookId: target.book.id };
    } else if (document) document = { ...document, bookId: target.book.id, version: (target.document?.version ?? 0) + 1 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    const result: InputCommitResult = { sessionId: session.id, bookId: destination.targetBookId ?? document?.bookId ?? crypto.randomUUID(), clientKey: destination.targetClientKey ?? document?.bookId, documentVersion: document?.version, destination: destination.type, committedAt: new Date().toISOString(), openPath: `/editor/${destination.targetClientKey ?? document?.bookId ?? "new"}?mode=${destination.openMode ?? "compose"}` };
    const next = transitionInputSession(session, "completed", { progress: 100, commitResult: result, retryable: false });
    demoSessions.set(next.id, next);
    return result;
  }

  const designPayload = (session.metadata.designPayload ?? null) as Record<string, unknown> | null;
  if (target) {
    const { error: targetUpdateError } = await client.from("input_sessions").update({
      target_book_id: target.book.id,
      destination: { ...destination, targetBookId: target.book.id, targetClientKey: target.book.client_key ?? destination.targetClientKey },
      expected_document_version: destination.expectedDocumentVersion ?? target.document?.version ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", session.id).eq("organization_id", input.organizationId);
    if (targetUpdateError) throw targetUpdateError;
  }
  const clientKey = destination.targetClientKey ?? target?.book.client_key ?? document?.bookId ?? `import-${session.id.replaceAll("-", "")}`;
  const title = document?.title ?? session.preview?.title ?? "Tài liệu nhập";
  const slug = `${title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "tai-lieu"}-${session.id.slice(0, 8)}`;
  return withInputTelemetry("input.commit", { traceId: session.traceId, sessionId: session.id, organizationId: input.organizationId, format: session.format, mode: session.mode }, async () => {
    try {
      const { data, error } = await client.rpc("commit_input_session_hardened", {
        p_session_id: session.id, p_title: title, p_language: document?.language ?? "vi", p_metadata: document?.metadata ?? {}, p_version: document?.version ?? 1,
        p_nodes: document ? flattenContentNodes(document.root) : [], p_design_payload: designPayload, p_client_key: clientKey, p_slug: slug,
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data) throw new Error(String((data as Record<string, unknown>).error ?? "INPUT_COMMIT_FAILED"));
      return data as InputCommitResult;
    } catch (error) {
      const code = inputErrorCode(error, "INPUT_COMMIT_FAILED");
      await client.from("input_sessions").update({ status: "recovery_required", retryable: isRetryableInputError(code), last_error_code: code, last_error_message: "Commit thất bại; preview vẫn được giữ để khôi phục.", updated_at: new Date().toISOString() }).eq("id", session.id).eq("organization_id", input.organizationId);
      await client.from("input_session_events").insert({ organization_id: input.organizationId, session_id: session.id, actor_id: input.userId, event_name: "session.recovery_required", status: "recovery_required", progress: 95, trace_id: session.traceId, payload: { errorCode: code } });
      logInputError(error, { event: "input.commit.recovery_required", traceId: session.traceId, sessionId: session.id, organizationId: input.organizationId });
      throw error;
    }
  });
}

export async function cancelInputSession(input: { organizationId: string; userId: string; sessionId: string }) {
  const session = await getInputSession(input.organizationId, input.sessionId);
  if (!session) throw new Error("INPUT_SESSION_NOT_FOUND");
  if (session.status === "completed") throw new Error("INPUT_SESSION_IMMUTABLE");
  const externalJobId = typeof session.metadata.externalJobId === "string" ? session.metadata.externalJobId : undefined;
  if (externalJobId) { const { cancelDocumentJob } = await import("@/lib/queue/document-queue"); await cancelDocumentJob(externalJobId).catch(() => false); }
  const client = await createSupabaseServerClient();
  if (!client) {
    const next = transitionInputSession(session, "cancelled", { cancellationRequested: true, retryable: true, stageMessage: "Đã hủy theo yêu cầu." });
    demoSessions.set(next.id, next); return next;
  }
  const { data, error } = await client.from("input_sessions").update({ status: "cancelled", cancellation_requested: true, retryable: true, updated_at: new Date().toISOString() }).eq("id", session.id).eq("organization_id", input.organizationId).select("*").single();
  if (error) throw error;
  await client.from("input_session_events").insert({ organization_id: input.organizationId, session_id: session.id, actor_id: input.userId, event_name: "session.cancelled", status: "cancelled", progress: session.progress, payload: {} });
  return rowToSession(data);
}

export async function retryInputSession(input: { organizationId: string; userId: string; sessionId: string; fromStage?: "validating" | "processing" | "committing" }) {
  const session = await getInputSession(input.organizationId, input.sessionId);
  if (!session) throw new Error("INPUT_SESSION_NOT_FOUND");
  if (!inputStatusCanRetry(session)) throw new Error("INPUT_SESSION_NOT_RETRYABLE");
  const nextStatus = input.fromStage ?? (session.status === "recovery_required" ? "committing" : "processing");
  const retryAfterMs = computeRetryDelayMs(session.attempt, { random: 0.5 });
  const policy = getInputRuntimePolicy(session.format, session.mode);
  const client = await createSupabaseServerClient();
  if (!client) {
    const next = transitionInputSession(session, nextStatus, { attempt: session.attempt + 1, retryable: true, errorCode: undefined, stageMessage: "Đang thử lại.", deadlineAt: new Date(Date.now() + policy.timeoutMs).toISOString(), heartbeatAt: new Date().toISOString(), metadata: { ...session.metadata, retryAfterMs } });
    demoSessions.set(next.id, next); return next;
  }
  const { data, error } = await client.from("input_sessions").update({ status: nextStatus, attempt: session.attempt + 1, retryable: true, cancellation_requested: false, last_error_code: null, last_error_message: null, processing_deadline_at: new Date(Date.now() + policy.timeoutMs).toISOString(), heartbeat_at: new Date().toISOString(), metadata: { ...session.metadata, retryAfterMs }, updated_at: new Date().toISOString() }).eq("id", session.id).eq("organization_id", input.organizationId).select("*").single();
  if (error) throw error;
  await client.from("input_session_events").insert({ organization_id: input.organizationId, session_id: session.id, actor_id: input.userId, event_name: "session.retry_requested", status: nextStatus, progress: session.progress, trace_id: session.traceId, payload: { attempt: session.attempt + 1, retryAfterMs } });
  return rowToSession(data);
}
