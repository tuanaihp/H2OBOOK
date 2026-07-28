import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { saveInputPreview } from "@/lib/input/orchestrator-server";
import type { ImportDocument, InputCorrection } from "@h2obook/input-core";
import { readJsonBody } from "@/lib/security/request-limits";
import { inputErrorResponse } from "@/lib/input/api-errors";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  try {
    const body = await readJsonBody<{ organizationId?: string; preview?: ImportDocument; corrections?: InputCorrection[]; designPayload?: Record<string, unknown> }>(request, 65 * 1024 * 1024);
    if (!body?.preview) throw new Error("INPUT_PREVIEW_REQUIRED");
    const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "designer", "partner", "teacher"]);
    if (!access) throw new Error("WORKSPACE_FORBIDDEN");
    const { id } = await params;
    const session = await saveInputPreview({ organizationId: access.organizationId, userId: auth.user!.id, sessionId: id, preview: body.preview, corrections: body.corrections, designPayload: body.designPayload });
    return NextResponse.json({ session }, { headers: session.traceId ? { "x-trace-id": session.traceId } : undefined });
  } catch (error) { return inputErrorResponse(error, request, "INPUT_PREVIEW_SAVE_FAILED"); }
}
