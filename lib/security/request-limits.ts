export class RequestLimitError extends Error {
  status: number;
  constructor(code: string, status = 413) { super(code); this.name = "RequestLimitError"; this.status = status; }
}

export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestLimitError("REQUEST_BODY_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new RequestLimitError("REQUEST_BODY_TOO_LARGE");
  try { return JSON.parse(text) as T; } catch { throw new RequestLimitError("INVALID_JSON", 400); }
}

export function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, Math.trunc(numeric))) : fallback;
}
