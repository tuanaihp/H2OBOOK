import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { getInputSession, updateInputSession } from "@/lib/input/orchestrator-server";
import type { InputSessionStatus } from "@h2obook/input-core";
import { readJsonBody } from "@/lib/security/request-limits";
import { inputErrorResponse } from "@/lib/input/api-errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(); if (auth.response) return auth.response;
    const access = await resolveOrganizationAccess(auth.user!, new URL(request.url).searchParams.get("organizationId") ?? undefined);
    if (!access) throw new Error("WORKSPACE_FORBIDDEN");
    const { id } = await params; const session = await getInputSession(access.organizationId, id);
    if (!session) throw new Error("INPUT_SESSION_NOT_FOUND");
    return NextResponse.json({ session }, { headers: session.traceId ? { "x-trace-id": session.traceId } : undefined });
  } catch (error) { return inputErrorResponse(error, request, "INPUT_SESSION_READ_FAILED"); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  try {
    const body = await readJsonBody<{ organizationId?: string; status?: InputSessionStatus; progress?: number; stageMessage?: string; metadata?: Record<string, unknown>; externalJobId?: string; eventName?: string }>(request, 3 * 1024 * 1024);
    const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
    if (!access) throw new Error("WORKSPACE_FORBIDDEN");
    const { id } = await params;
    const session = await updateInputSession({ organizationId: access.organizationId, userId: auth.user!.id, sessionId: id, status: body?.status, progress: body?.progress, stageMessage: body?.stageMessage, metadata: body?.metadata, externalJobId: body?.externalJobId, eventName: body?.eventName });
    return NextResponse.json({ session }, { headers: session.traceId ? { "x-trace-id": session.traceId } : undefined });
  } catch (error) { return inputErrorResponse(error, request, "INPUT_SESSION_UPDATE_FAILED"); }
}
