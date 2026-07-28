import { NextResponse } from "next/server";
import { inputErrorCode, isRetryableInputError } from "@h2obook/input-core";
import { logInputError, resolveInputTraceId } from "@/lib/observability/input-observability";
import { RequestLimitError } from "@/lib/security/request-limits";

const statusByCode: Record<string, number> = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, WORKSPACE_FORBIDDEN: 403, JOB_FORBIDDEN: 403,
  INPUT_SESSION_NOT_FOUND: 404, ASSET_NOT_FOUND: 404, BOOK_NOT_FOUND: 404,
  INPUT_VERSION_CONFLICT: 409, INPUT_SESSION_IMMUTABLE: 409, INPUT_SESSION_NOT_COMMITTABLE: 409,
  ASSET_SCAN_PENDING: 423, ASSET_SCAN_BLOCKED: 422, RATE_LIMITED: 429,
  REQUEST_BODY_TOO_LARGE: 413, INPUT_PREVIEW_TOO_LARGE: 413, INPUT_DESIGN_PAYLOAD_TOO_LARGE: 413,
  IMPORT_NODE_LIMIT_EXCEEDED: 422, IMPORT_TEXT_LIMIT_EXCEEDED: 422, IMPORT_ASSET_LIMIT_EXCEEDED: 422,
};

export function inputErrorResponse(error: unknown, request?: Request, fallback = "INPUT_REQUEST_FAILED", extra: Record<string, unknown> = {}) {
  const traceId = resolveInputTraceId(request);
  const code = inputErrorCode(error, fallback);
  const status = error instanceof RequestLimitError ? error.status : statusByCode[code] ?? (/^(INPUT_|IMPORT_|PDF_|HTML_|DOCX_|IMAGE_)/.test(code) ? 400 : 500);
  logInputError(error, { event: "input.api.error", traceId, errorCode: code });
  return NextResponse.json({ error: code, retryable: isRetryableInputError(code), traceId, ...extra }, { status, headers: { "x-trace-id": traceId } });
}
