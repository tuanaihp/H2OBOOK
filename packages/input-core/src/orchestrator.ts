import type { BookDocument, SemanticContentNode } from "@h2obook/content-core";
import type { ImportDocument, ImportWarning, InputFormat } from "./types";
import type { InputMode, InputSession, InputSessionStatus } from "./session";
import { DEFAULT_INPUT_HARDENING_LIMITS, getInputRuntimePolicy, validateCorrections, validateImportDocumentLimits, validateInputSessionEnvelope } from "./hardening";

export type InputDestination = "new_book" | "append_chapter" | "replace_document" | "design_pages";
export type InputSourceKind = "file" | "url" | "local";
export type InputSessionEventName =
  | "session.created" | "session.detected" | "session.validated" | "session.scan_started"
  | "session.scan_completed" | "session.processing_started" | "session.progress"
  | "session.preview_ready" | "session.correction_saved" | "session.commit_started"
  | "session.completed" | "session.retry_requested" | "session.cancel_requested"
  | "session.cancelled" | "session.recovered" | "session.failed";

export type InputSourceDescriptor = {
  kind: InputSourceKind;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  assetId?: string;
  storageKey?: string;
  url?: string;
  finalUrl?: string;
};

export type InputDestinationConfig = {
  type: InputDestination;
  targetBookId?: string;
  targetClientKey?: string;
  expectedDocumentVersion?: number;
  chapterTitle?: string;
  openMode?: "compose" | "design";
};

export type InputCorrection = {
  nodeId: string;
  text?: string;
  attrs?: Record<string, unknown>;
  deleted?: boolean;
  position?: number;
  parentId?: string | null;
};

export type InputCommitResult = {
  sessionId: string;
  bookId: string;
  clientKey?: string;
  documentId?: string;
  documentVersion?: number;
  destination: InputDestination;
  committedAt: string;
  alreadyCommitted?: boolean;
  openPath?: string;
};

export type OrchestratedInputSession = InputSession & {
  schemaVersion: 1;
  source: InputSourceDescriptor;
  destination: InputDestinationConfig;
  attempt: number;
  progress: number;
  stageMessage?: string;
  preview?: ImportDocument;
  corrections: InputCorrection[];
  commitResult?: InputCommitResult;
  recoveryToken?: string;
  retryable: boolean;
  cancellationRequested: boolean;
  expiresAt?: string;
  traceId?: string;
  deadlineAt?: string;
  heartbeatAt?: string;
};

export type InputSessionEvent = {
  id: string;
  sessionId: string;
  name: InputSessionEventName;
  status: InputSessionStatus;
  progress: number;
  payload: Record<string, unknown>;
  occurredAt: string;
};

const transitions: Record<InputSessionStatus, InputSessionStatus[]> = {
  created: ["detected", "failed", "cancelled"],
  detected: ["validating", "failed", "cancelled"],
  validating: ["uploading", "scanning", "processing", "failed", "cancelled"],
  uploading: ["scanning", "processing", "failed", "cancelled"],
  scanning: ["queued", "processing", "failed", "cancelled"],
  queued: ["processing", "failed", "cancelled"],
  processing: ["preview", "failed", "cancelled"],
  preview: ["correcting", "committing", "processing", "cancelled", "failed"],
  correcting: ["preview", "committing", "cancelled", "failed"],
  committing: ["completed", "recovery_required", "failed"],
  recovery_required: ["committing", "processing", "cancelled", "failed"],
  completed: [],
  failed: ["validating", "processing", "committing", "cancelled"],
  cancelled: ["validating", "processing"],
};

export function canTransitionInputSession(from: InputSessionStatus, to: InputSessionStatus) {
  return transitions[from]?.includes(to) ?? false;
}

export function transitionInputSession<T extends OrchestratedInputSession>(
  session: T,
  status: InputSessionStatus,
  patch: Partial<T> = {},
): T {
  if (session.status !== status && !canTransitionInputSession(session.status, status)) {
    throw new Error(`INPUT_INVALID_TRANSITION:${session.status}->${status}`);
  }
  const now = new Date().toISOString();
  const progress = status === "completed" ? 100 : Math.max(0, Math.min(99, Number(patch.progress ?? session.progress)));
  return { ...session, ...patch, status, progress, updatedAt: now } as T;
}

export function inputStatusIsTerminal(status: InputSessionStatus) {
  return status === "completed" || status === "cancelled";
}

export function inputStatusCanRetry(session: Pick<OrchestratedInputSession, "status" | "retryable" | "attempt" | "format" | "mode">) {
  const policy = getInputRuntimePolicy(session.format, session.mode);
  return session.retryable && ["failed", "cancelled", "recovery_required"].includes(session.status) && session.attempt < Math.min(DEFAULT_INPUT_HARDENING_LIMITS.maxSessionAttempts, policy.maxAttempts);
}

export function destinationRequiresBook(destination: InputDestination) {
  return destination !== "new_book";
}

export function validateDestination(destination: InputDestinationConfig) {
  if (destinationRequiresBook(destination.type) && !destination.targetBookId && !destination.targetClientKey) {
    throw new Error("INPUT_TARGET_BOOK_REQUIRED");
  }
  if (destination.type === "append_chapter" && !destination.chapterTitle?.trim()) {
    return { ...destination, chapterTitle: "Nội dung nhập" };
  }
  return destination;
}

function textOf(node: SemanticContentNode) {
  return node.text?.map((span) => span.text).join("") ?? "";
}

function cloneNode(node: SemanticContentNode): SemanticContentNode {
  return { ...node, text: node.text?.map((span) => ({ ...span, marks: span.marks?.map((mark) => ({ ...mark, attrs: mark.attrs ? { ...mark.attrs } : undefined })) })), attrs: { ...node.attrs }, children: node.children.map(cloneNode) };
}

export function applyInputCorrections(document: BookDocument, corrections: InputCorrection[]) {
  validateCorrections(corrections);
  if (!corrections.length) return document;
  const correctionMap = new Map(corrections.map((correction) => [correction.nodeId, correction]));
  const visit = (nodes: SemanticContentNode[], parentId: string | null): SemanticContentNode[] => nodes
    .filter((node) => !correctionMap.get(node.id)?.deleted)
    .map((source, index) => {
      const correction = correctionMap.get(source.id);
      const node = cloneNode(source);
      if (correction?.text !== undefined) node.text = [{ text: correction.text }];
      if (correction?.attrs) node.attrs = { ...node.attrs, ...correction.attrs };
      node.parentId = correction?.parentId !== undefined ? correction.parentId : parentId;
      node.position = correction?.position ?? index;
      node.children = visit(node.children, node.id);
      return node;
    })
    .sort((a, b) => a.position - b.position)
    .map((node, index) => ({ ...node, position: index }));
  return { ...document, root: visit(document.root, null), updatedAt: new Date().toISOString(), version: Math.max(1, document.version) };
}

export function appendImportAsChapter(existing: BookDocument, imported: BookDocument, chapterTitle = "Nội dung nhập") {
  const importedRoot = imported.root.map(cloneNode);
  const chapterId = crypto.randomUUID();
  const chapter: SemanticContentNode = {
    id: chapterId,
    type: "chapter",
    parentId: null,
    position: existing.root.length,
    text: [{ text: chapterTitle }],
    attrs: { importedFrom: imported.metadata.sourceType ?? imported.metadata.importEngine ?? imported.title, importedAt: new Date().toISOString() },
    children: importedRoot.map((node, index) => ({ ...node, parentId: chapterId, position: index })),
    version: 1,
  };
  return {
    ...existing,
    root: [...existing.root.map(cloneNode), chapter],
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
    metadata: { ...existing.metadata, lastImportTitle: imported.title, lastImportedAt: new Date().toISOString() },
  };
}

export function importDocumentHasBlockingErrors(input: Pick<ImportDocument, "warnings">) {
  return input.warnings.some((warning) => warning.severity === "error");
}

export function summarizeWarnings(warnings: ImportWarning[]) {
  return warnings.reduce((summary, warning) => {
    summary[warning.severity] += 1;
    return summary;
  }, { info: 0, warning: 0, error: 0 });
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
}

export function inputFingerprint(input: { format: InputFormat; mode: InputMode; source: InputSourceDescriptor; destination: InputDestinationConfig }) {
  const serialized = stable({ format: input.format, mode: input.mode, source: input.source, destination: input.destination });
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `input-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createOrchestratedSession(input: {
  id?: string;
  organizationId?: string;
  bookId?: string;
  sourceName: string;
  mimeType?: string;
  format: InputFormat;
  mode: InputMode;
  source: InputSourceDescriptor;
  destination: InputDestinationConfig;
  idempotencyKey?: string;
}): OrchestratedInputSession {
  const now = new Date().toISOString();
  const destination = validateDestination(input.destination);
  validateInputSessionEnvelope({ sourceName: input.sourceName, format: input.format, mode: input.mode, source: input.source, destination });
  const policy = getInputRuntimePolicy(input.format, input.mode);
  return {
    id: input.id ?? crypto.randomUUID(),
    schemaVersion: 1,
    organizationId: input.organizationId,
    bookId: input.bookId,
    sourceName: input.sourceName,
    mimeType: input.mimeType,
    format: input.format,
    mode: input.mode,
    status: "created",
    idempotencyKey: input.idempotencyKey ?? inputFingerprint({ format: input.format, mode: input.mode, source: input.source, destination }),
    createdAt: now,
    updatedAt: now,
    metadata: {},
    source: input.source,
    destination,
    attempt: 0,
    progress: 0,
    corrections: [],
    retryable: true,
    cancellationRequested: false,
    deadlineAt: new Date(Date.now() + policy.timeoutMs).toISOString(),
    heartbeatAt: now,
  };
}

export function importDocumentToSessionPreview(session: OrchestratedInputSession, preview: ImportDocument) {
  validateImportDocumentLimits(preview);
  if (importDocumentHasBlockingErrors(preview)) {
    return transitionInputSession(session, "failed", { preview, retryable: true, errorCode: "IMPORT_PREVIEW_BLOCKED", stageMessage: "Preview có lỗi bắt buộc xử lý." });
  }
  return transitionInputSession(session, "preview", { preview, progress: 85, retryable: true, stageMessage: "Preview đã sẵn sàng." });
}

export function sessionEvent(session: OrchestratedInputSession, name: InputSessionEventName, payload: Record<string, unknown> = {}): InputSessionEvent {
  return { id: crypto.randomUUID(), sessionId: session.id, name, status: session.status, progress: session.progress, payload, occurredAt: new Date().toISOString() };
}

export function plainTextToImportDocument(input: { sourceFileName: string; text: string; format: "txt" | "markdown"; title?: string; bookId: string; organizationId?: string }): ImportDocument {
  const now = new Date().toISOString();
  const lines = input.text.replace(/\r\n?/g, "\n").split("\n");
  const nodes: SemanticContentNode[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const value = paragraph.join(" ").trim();
    if (value) nodes.push({ id: crypto.randomUUID(), type: "paragraph", parentId: null, position: nodes.length, text: [{ text: value }], attrs: {}, children: [], version: 1 });
    paragraph = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = input.format === "markdown" ? /^(#{1,6})\s+(.+)$/.exec(line) : null;
    if (heading) {
      flush();
      nodes.push({ id: crypto.randomUUID(), type: "heading", parentId: null, position: nodes.length, text: [{ text: heading[2] }], attrs: { level: heading[1].length }, children: [], version: 1 });
    } else if (!line) flush();
    else paragraph.push(line);
  }
  flush();
  const title = input.title?.trim() || input.sourceFileName.replace(/\.(md|markdown|txt)$/i, "") || "Tài liệu nhập";
  const chapterId = crypto.randomUUID();
  const root: SemanticContentNode[] = [{ id: chapterId, type: "chapter", parentId: null, position: 0, text: [{ text: title }], attrs: { sourceFormat: input.format }, children: nodes.map((node, index) => ({ ...node, parentId: chapterId, position: index })), version: 1 }];
  const words = input.text.trim() ? input.text.trim().split(/\s+/).length : 0;
  const document: BookDocument = { id: crypto.randomUUID(), bookId: input.bookId, organizationId: input.organizationId, title, language: "vi", root, metadata: { sourceType: input.format, sourceFileName: input.sourceFileName, importedAt: now, importEngine: "unified-orchestrator-1.0" }, version: 1, createdAt: now, updatedAt: now };
  return { format: input.format, sourceFileName: input.sourceFileName, title, document, nodes: root, assets: [], warnings: [], statistics: { nodes: nodes.length + 1, headings: nodes.filter((node) => node.type === "heading").length, paragraphs: nodes.filter((node) => node.type === "paragraph").length, lists: 0, tables: 0, images: 0, footnotes: 0, words }, metadata: document.metadata };
}

export function sessionDisplayStage(status: InputSessionStatus) {
  const labels: Record<InputSessionStatus, string> = {
    created: "Đã tạo phiên", detected: "Đã nhận dạng", validating: "Đang kiểm tra", uploading: "Đang tải lên",
    scanning: "Đang quét bảo mật", queued: "Đang chờ xử lý", processing: "Đang xử lý", preview: "Sẵn sàng xem trước",
    correcting: "Đang hiệu chỉnh", committing: "Đang nhập", completed: "Hoàn thành", failed: "Có lỗi",
    cancelled: "Đã hủy", recovery_required: "Cần khôi phục",
  };
  return labels[status];
}

export function extractSessionOutline(document?: BookDocument) {
  if (!document) return [];
  const result: Array<{ id: string; type: string; label: string; depth: number }> = [];
  const visit = (nodes: SemanticContentNode[], depth: number) => nodes.forEach((node) => {
    if (["chapter", "section", "heading"].includes(node.type)) result.push({ id: node.id, type: node.type, label: textOf(node) || String(node.attrs.title ?? node.type), depth });
    visit(node.children, depth + 1);
  });
  visit(document.root, 0);
  return result;
}
