import type { ImportDocument } from "./types";
import type { InputCorrection, InputDestinationConfig, InputSourceDescriptor } from "./orchestrator";
import type { InputFormat, ImportWarning } from "./types";
import type { InputMode } from "./session";

export type InputHardeningLimits = {
  maxSourceNameChars: number;
  maxUrlChars: number;
  maxSessionAttempts: number;
  maxCorrections: number;
  maxNodes: number;
  maxAssets: number;
  maxWarnings: number;
  maxPreviewBytes: number;
  maxDesignPayloadBytes: number;
  maxMetadataBytes: number;
  maxNodeTextChars: number;
};

export const DEFAULT_INPUT_HARDENING_LIMITS: InputHardeningLimits = Object.freeze({
  maxSourceNameChars: 240,
  maxUrlChars: 2_048,
  maxSessionAttempts: 5,
  maxCorrections: 5_000,
  maxNodes: 50_000,
  maxAssets: 5_000,
  maxWarnings: 5_000,
  maxPreviewBytes: 25 * 1024 * 1024,
  maxDesignPayloadBytes: 50 * 1024 * 1024,
  maxMetadataBytes: 2 * 1024 * 1024,
  maxNodeTextChars: 2_000_000,
});

export type InputRuntimePolicy = {
  timeoutMs: number;
  heartbeatMs: number;
  staleAfterMs: number;
  maxAttempts: number;
};

const minute = 60_000;
const runtimePolicy: Record<InputFormat, Partial<Record<InputMode, InputRuntimePolicy>>> = {
  docx: { editable_content: { timeoutMs: 10 * minute, heartbeatMs: 15_000, staleAfterMs: 3 * minute, maxAttempts: 3 } },
  pdf: {
    fixed_layout: { timeoutMs: 30 * minute, heartbeatMs: 15_000, staleAfterMs: 4 * minute, maxAttempts: 3 },
    editable_content: { timeoutMs: 30 * minute, heartbeatMs: 15_000, staleAfterMs: 4 * minute, maxAttempts: 3 },
    ocr: { timeoutMs: 45 * minute, heartbeatMs: 15_000, staleAfterMs: 5 * minute, maxAttempts: 3 },
  },
  png: {
    asset: { timeoutMs: 5 * minute, heartbeatMs: 15_000, staleAfterMs: 2 * minute, maxAttempts: 3 },
    full_page: { timeoutMs: 5 * minute, heartbeatMs: 15_000, staleAfterMs: 2 * minute, maxAttempts: 3 },
    ocr: { timeoutMs: 15 * minute, heartbeatMs: 15_000, staleAfterMs: 3 * minute, maxAttempts: 3 },
    manual_regions: { timeoutMs: 20 * minute, heartbeatMs: 15_000, staleAfterMs: 3 * minute, maxAttempts: 3 },
  },
  jpeg: {
    asset: { timeoutMs: 5 * minute, heartbeatMs: 15_000, staleAfterMs: 2 * minute, maxAttempts: 3 },
    full_page: { timeoutMs: 5 * minute, heartbeatMs: 15_000, staleAfterMs: 2 * minute, maxAttempts: 3 },
    ocr: { timeoutMs: 15 * minute, heartbeatMs: 15_000, staleAfterMs: 3 * minute, maxAttempts: 3 },
    manual_regions: { timeoutMs: 20 * minute, heartbeatMs: 15_000, staleAfterMs: 3 * minute, maxAttempts: 3 },
  },
  html: { editable_content: { timeoutMs: 10 * minute, heartbeatMs: 15_000, staleAfterMs: 3 * minute, maxAttempts: 3 } },
  markdown: { editable_content: { timeoutMs: 3 * minute, heartbeatMs: 15_000, staleAfterMs: 2 * minute, maxAttempts: 2 } },
  txt: { editable_content: { timeoutMs: 3 * minute, heartbeatMs: 15_000, staleAfterMs: 2 * minute, maxAttempts: 2 } },
  url: { editable_content: { timeoutMs: 12 * minute, heartbeatMs: 15_000, staleAfterMs: 3 * minute, maxAttempts: 3 } },
};

export function getInputRuntimePolicy(format: InputFormat, mode: InputMode): InputRuntimePolicy {
  return runtimePolicy[format]?.[mode] ?? { timeoutMs: 15 * minute, heartbeatMs: 15_000, staleAfterMs: 3 * minute, maxAttempts: 3 };
}

export function jsonSizeBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength;
}

export function createInputTraceId(): string {
  return `itr_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function validateInputSessionEnvelope(input: {
  sourceName: string;
  format: InputFormat;
  mode: InputMode;
  source: InputSourceDescriptor;
  destination: InputDestinationConfig;
}, limits: InputHardeningLimits = DEFAULT_INPUT_HARDENING_LIMITS) {
  if (!input.sourceName.trim() || input.sourceName.length > limits.maxSourceNameChars) throw new Error("INPUT_SOURCE_NAME_INVALID");
  if (input.source.kind === "url") {
    const url = input.source.url ?? "";
    if (!url || url.length > limits.maxUrlChars) throw new Error("INPUT_URL_INVALID");
  }
  if (jsonSizeBytes(input.source) > limits.maxMetadataBytes) throw new Error("INPUT_SOURCE_METADATA_TOO_LARGE");
  if (jsonSizeBytes(input.destination) > 64 * 1024) throw new Error("INPUT_DESTINATION_TOO_LARGE");
  return true;
}

function countNodes(document: ImportDocument) {
  let nodes = 0;
  let textChars = 0;
  const visit = (items: typeof document.document.root) => {
    for (const node of items) {
      nodes += 1;
      for (const span of node.text ?? []) textChars += span.text.length;
      visit(node.children);
    }
  };
  visit(document.document.root);
  return { nodes, textChars };
}

export function validateImportDocumentLimits(document: ImportDocument, limits: InputHardeningLimits = DEFAULT_INPUT_HARDENING_LIMITS) {
  const measured = countNodes(document);
  if (measured.nodes > limits.maxNodes) throw new Error("IMPORT_NODE_LIMIT_EXCEEDED");
  if (measured.textChars > limits.maxNodeTextChars) throw new Error("IMPORT_TEXT_LIMIT_EXCEEDED");
  if (document.assets.length > limits.maxAssets) throw new Error("IMPORT_ASSET_LIMIT_EXCEEDED");
  if (document.warnings.length > limits.maxWarnings) throw new Error("IMPORT_WARNING_LIMIT_EXCEEDED");
  if (jsonSizeBytes(document) > limits.maxPreviewBytes) throw new Error("IMPORT_PREVIEW_TOO_LARGE");
  return measured;
}

export function validateCorrections(corrections: InputCorrection[], limits: InputHardeningLimits = DEFAULT_INPUT_HARDENING_LIMITS) {
  if (corrections.length > limits.maxCorrections) throw new Error("INPUT_CORRECTION_LIMIT_EXCEEDED");
  if (jsonSizeBytes(corrections) > 5 * 1024 * 1024) throw new Error("INPUT_CORRECTIONS_TOO_LARGE");
  for (const correction of corrections) {
    if (!correction.nodeId || correction.nodeId.length > 160) throw new Error("INPUT_CORRECTION_NODE_INVALID");
    if (correction.text && correction.text.length > 250_000) throw new Error("INPUT_CORRECTION_TEXT_TOO_LARGE");
  }
  return true;
}

export function validateDesignPayload(payload: Record<string, unknown> | undefined, limits: InputHardeningLimits = DEFAULT_INPUT_HARDENING_LIMITS) {
  if (payload && jsonSizeBytes(payload) > limits.maxDesignPayloadBytes) throw new Error("INPUT_DESIGN_PAYLOAD_TOO_LARGE");
  return true;
}

export const NON_RETRYABLE_INPUT_ERRORS = new Set([
  "WORKSPACE_FORBIDDEN", "FORBIDDEN", "UNAUTHENTICATED", "INPUT_FORMAT_UNSUPPORTED", "INPUT_MODE_UNSUPPORTED",
  "INPUT_MIME_MISMATCH", "MAGIC_BYTES_MISMATCH", "ZIP_BOMB_RISK", "ZIP_PATH_TRAVERSAL", "ASSET_SCAN_BLOCKED",
  "PDF_PASSWORD_PROTECTED", "INPUT_VERSION_CONFLICT", "IMPORT_PREVIEW_BLOCKED", "IMPORT_NODE_LIMIT_EXCEEDED",
  "IMPORT_TEXT_LIMIT_EXCEEDED", "IMPORT_ASSET_LIMIT_EXCEEDED", "INPUT_CORRECTION_LIMIT_EXCEEDED",
]);

export function inputErrorCode(error: unknown, fallback = "INPUT_UNKNOWN_ERROR") {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  const candidate = raw.split(":")[0]?.trim().replace(/[^A-Z0-9_]/g, "_");
  return candidate && /^[A-Z][A-Z0-9_]{2,80}$/.test(candidate) ? candidate : fallback;
}

export function isRetryableInputError(error: unknown) {
  const code = inputErrorCode(error);
  if (NON_RETRYABLE_INPUT_ERRORS.has(code)) return false;
  if (/^(UPSTREAM_4\d\d|PROCESSOR_4\d\d|INPUT_.*INVALID|.*_NOT_FOUND)$/.test(code)) return false;
  return true;
}

export function computeRetryDelayMs(attempt: number, input?: { baseMs?: number; maxMs?: number; jitterRatio?: number; random?: number }) {
  const base = Math.max(250, input?.baseMs ?? 2_000);
  const max = Math.max(base, input?.maxMs ?? 120_000);
  const jitterRatio = Math.max(0, Math.min(0.5, input?.jitterRatio ?? 0.2));
  const exponential = Math.min(max, base * 2 ** Math.max(0, attempt));
  const random = Math.max(0, Math.min(1, input?.random ?? Math.random()));
  return Math.round(exponential * (1 - jitterRatio + random * jitterRatio * 2));
}

const sensitiveKey = /(content|text|html|body|document|preview|correction|authorization|token|secret|password|cookie|email|phone|address)/i;

export function redactInputTelemetry(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 80)}…[${value.length} chars]` : value;
  if (Array.isArray(value)) return { count: value.length, sample: value.slice(0, 3).map((item) => redactInputTelemetry(item, depth + 1)) };
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = sensitiveKey.test(key) ? "[REDACTED]" : redactInputTelemetry(item, depth + 1);
  }
  return output;
}

export function compactWarnings(warnings: ImportWarning[]) {
  return warnings.slice(0, 100).map((warning) => ({ code: warning.code, severity: warning.severity }));
}
