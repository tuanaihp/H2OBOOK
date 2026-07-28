import { createInputTraceId, inputErrorCode, redactInputTelemetry } from "@h2obook/input-core";

export type InputLogLevel = "debug" | "info" | "warn" | "error";
export type InputTelemetryEvent = {
  event?: string;
  traceId?: string;
  sessionId?: string;
  jobId?: string;
  organizationId?: string;
  format?: string;
  mode?: string;
  durationMs?: number;
  progress?: number;
  attempt?: number;
  errorCode?: string;
  metrics?: Record<string, unknown>;
};

export function resolveInputTraceId(request?: Request, fallback?: string) {
  const header = request?.headers.get("x-request-id") || request?.headers.get("x-trace-id");
  return header && /^[a-zA-Z0-9._:-]{8,160}$/.test(header) ? header : fallback ?? createInputTraceId();
}

export function inputLog(level: InputLogLevel, data: InputTelemetryEvent & Record<string, unknown>) {
  const record = {
    timestamp: new Date().toISOString(),
    service: "h2obook-input",
    level,
    ...redactInputTelemetry(data) as Record<string, unknown>,
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInputError(error: unknown, data: Omit<InputTelemetryEvent, "errorCode"> & Record<string, unknown> = {}) {
  const code = inputErrorCode(error);
  inputLog("error", { ...data, event: data.event ?? "input.error", errorCode: code, errorName: error instanceof Error ? error.name : typeof error });
  return code;
}

export async function withInputTelemetry<T>(event: string, data: InputTelemetryEvent, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  inputLog("info", { ...data, event: `${event}.started` });
  try {
    const result = await run();
    inputLog("info", { ...data, event: `${event}.completed`, durationMs: Math.round(performance.now() - started) });
    return result;
  } catch (error) {
    logInputError(error, { ...data, event: `${event}.failed`, durationMs: Math.round(performance.now() - started) });
    throw error;
  }
}
