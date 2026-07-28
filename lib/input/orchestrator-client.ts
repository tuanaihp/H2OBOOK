"use client";
import type { ImportDocument, InputCorrection, InputDestinationConfig, InputMode, InputSourceDescriptor, OrchestratedInputSession } from "@h2obook/input-core";
import { createOrchestratedSession, detectInputFormat, inputFingerprint, inputModeMatrix } from "@h2obook/input-core";

const KEY = "h2obook-input-sessions-v1";
function localSessions(): OrchestratedInputSession[] { if (typeof localStorage === "undefined") return []; try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OrchestratedInputSession[]; } catch { return []; } }
function saveLocal(session: OrchestratedInputSession) { if (typeof localStorage === "undefined") return; const sessions = localSessions().filter((item) => item.id !== session.id); localStorage.setItem(KEY, JSON.stringify([session, ...sessions].slice(0, 50))); }
async function json<T>(response: Response): Promise<T> { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(String(body.error ?? `HTTP_${response.status}`)); return body as T; }

export async function createOrResumeInputSession(input: {
  organizationId?: string; sourceName: string; mimeType?: string; format?: ReturnType<typeof detectInputFormat>; mode?: InputMode;
  source: InputSourceDescriptor; destination: InputDestinationConfig; idempotencyKey?: string;
}) {
  const format = input.format ?? detectInputFormat({ fileName: input.source.fileName ?? input.sourceName, mimeType: input.mimeType ?? input.source.mimeType, url: input.source.url });
  if (!format) throw new Error("INPUT_FORMAT_UNSUPPORTED");
  const mode = input.mode ?? inputModeMatrix[format][0];
  const idempotencyKey = input.idempotencyKey ?? inputFingerprint({ format, mode, source: input.source, destination: input.destination });
  try {
    const response = await fetch("/api/input/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, format, mode, idempotencyKey }) });
    const result = await json<{ session: OrchestratedInputSession; duplicate: boolean }>(response); saveLocal(result.session); return result;
  } catch (error) {
    if (typeof navigator !== "undefined" && navigator.onLine) throw error;
    const existing = localSessions().find((session) => session.idempotencyKey === idempotencyKey);
    if (existing) return { session: existing, duplicate: true, offline: true };
    const session = { ...createOrchestratedSession({ organizationId: input.organizationId, sourceName: input.sourceName, mimeType: input.mimeType, format, mode, source: input.source, destination: input.destination, idempotencyKey }), status: "detected" as const, progress: 5, metadata: { offline: true } };
    saveLocal(session); return { session, duplicate: false, offline: true };
  }
}

export async function saveOrchestratorPreview(input: { organizationId?: string; session: OrchestratedInputSession; preview: ImportDocument; corrections?: InputCorrection[]; designPayload?: Record<string, unknown> }) {
  try {
    const response = await fetch(`/api/input/sessions/${input.session.id}/preview`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: input.organizationId, preview: input.preview, corrections: input.corrections, designPayload: input.designPayload }) });
    const result = await json<{ session: OrchestratedInputSession }>(response); saveLocal(result.session); return result.session;
  } catch (error) {
    if (typeof navigator !== "undefined" && navigator.onLine) throw error;
    const session: OrchestratedInputSession = { ...input.session, preview: input.preview, corrections: input.corrections ?? [], status: input.preview.warnings.some((warning) => warning.severity === "error") ? "failed" : "preview", progress: 85, updatedAt: new Date().toISOString(), metadata: { ...input.session.metadata, offline: true, ...(input.designPayload ? { designPayload: input.designPayload } : {}) } };
    saveLocal(session); return session;
  }
}

export async function commitOrchestratedInput(input: { organizationId?: string; session: OrchestratedInputSession; corrections?: InputCorrection[]; destination?: InputDestinationConfig }) {
  if (input.session.metadata.offline) throw new Error("INPUT_OFFLINE_COMMIT_REQUIRES_SYNC");
  const response = await fetch(`/api/input/sessions/${input.session.id}/commit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: input.organizationId, corrections: input.corrections, destination: input.destination }) });
  const result = await json<{ result: OrchestratedInputSession["commitResult"] }>(response);
  const session = { ...input.session, status: "completed" as const, progress: 100, retryable: false, commitResult: result.result, updatedAt: new Date().toISOString() }; saveLocal(session);
  return result.result;
}

export async function cancelOrchestratedInput(organizationId: string | undefined, session: OrchestratedInputSession) {
  if (session.metadata.offline) { const next = { ...session, status: "cancelled" as const, cancellationRequested: true, updatedAt: new Date().toISOString() }; saveLocal(next); return next; }
  const response = await fetch(`/api/input/sessions/${session.id}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId }) });
  const result = await json<{ session: OrchestratedInputSession }>(response); saveLocal(result.session); return result.session;
}

export async function retryOrchestratedInput(organizationId: string | undefined, session: OrchestratedInputSession, fromStage?: "validating" | "processing" | "committing") {
  const response = await fetch(`/api/input/sessions/${session.id}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, fromStage }) });
  const result = await json<{ session: OrchestratedInputSession }>(response); saveLocal(result.session); return result.session;
}

export async function recoverOrchestratedInput(organizationId: string | undefined, sessionId: string) {
  try {
    const response = await fetch(`/api/input/sessions/${sessionId}/recover?organizationId=${encodeURIComponent(organizationId ?? "")}`);
    const result = await json<{ session: OrchestratedInputSession; recovery: Record<string, unknown> }>(response); saveLocal(result.session); return result;
  } catch {
    const session = localSessions().find((item) => item.id === sessionId); if (!session) throw new Error("INPUT_SESSION_NOT_FOUND");
    return { session, recovery: { canResume: true, offline: true, hasPreview: Boolean(session.preview) } };
  }
}

export function listLocalInputSessions() { return localSessions(); }
