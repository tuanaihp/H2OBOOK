import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { approveSuggestion } from "@/lib/brain/admin";
import { isStageSurface } from "@/lib/academy-control/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const result = await approveSuggestion(access!, id, {
    stageId: typeof body?.stageId === "string" && body.stageId ? body.stageId : undefined,
    // undefined leaves the suggestion's own value; null clears it.
    nodeId: typeof body?.nodeId === "string" ? body.nodeId || null : body?.nodeId === null ? null : undefined,
    surface: isStageSurface(body?.surface) ? body.surface : body?.surface === null || body?.surface === "" ? null : undefined,
    note: typeof body?.note === "string" ? body.note : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data);
}
