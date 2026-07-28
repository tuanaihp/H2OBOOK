import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createInputSession, listInputSessions } from "@/lib/input/orchestrator-server";
import { detectInputFormat, inputModeMatrix, type InputDestinationConfig, type InputFormat, type InputMode, type InputSourceDescriptor } from "@h2obook/input-core";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";
import { readJsonBody } from "@/lib/security/request-limits";
import { inputErrorResponse } from "@/lib/input/api-errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(); if (auth.response) return auth.response;
    const url = new URL(request.url);
    const access = await resolveOrganizationAccess(auth.user!, url.searchParams.get("organizationId") ?? undefined);
    if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
    const sessions = await listInputSessions(access.organizationId, Number(url.searchParams.get("limit") ?? 50));
    return NextResponse.json({ sessions, mode: auth.user!.demo ? "demo" : "database" });
  } catch (error) { return inputErrorResponse(error, request, "INPUT_SESSION_LIST_FAILED"); }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const limited = await rateLimit(requestIdentity(request, "input-session-create"), 30, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const body = await readJsonBody<{
      organizationId?: string; sourceName?: string; mimeType?: string; format?: InputFormat; mode?: InputMode;
      source?: InputSourceDescriptor; destination?: InputDestinationConfig; idempotencyKey?: string;
    }>(request, 256 * 1024);
    if (!body?.sourceName || !body.source || !body.destination) throw new Error("INPUT_SESSION_PAYLOAD_REQUIRED");
    const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
    if (!access) throw new Error("WORKSPACE_FORBIDDEN");
    const format = body.format ?? detectInputFormat({ fileName: body.source.fileName ?? body.sourceName, mimeType: body.mimeType ?? body.source.mimeType, url: body.source.url });
    if (!format) throw new Error("INPUT_FORMAT_UNSUPPORTED");
    const mode = body.mode ?? inputModeMatrix[format][0];
    if (!inputModeMatrix[format].includes(mode)) throw new Error("INPUT_MODE_UNSUPPORTED");
    const result = await createInputSession({ organizationId: access.organizationId, userId: auth.user!.id, sourceName: body.sourceName, mimeType: body.mimeType, format, mode, source: body.source, destination: body.destination, idempotencyKey: body.idempotencyKey });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: result.session.traceId ? { "x-trace-id": result.session.traceId } : undefined });
  } catch (error) { return inputErrorResponse(error, request, "INPUT_SESSION_CREATE_FAILED"); }
}
