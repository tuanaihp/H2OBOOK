import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { createNode } from "@/lib/academy-control/admin";
import { loadStageNodes } from "@/lib/academy-control/service";
import { isStageNodeType, isStageSurface } from "@/lib/academy-control/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const items = await loadStageNodes(access!.organizationId, id);
  return NextResponse.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!isStageNodeType(body?.nodeType)) return NextResponse.json({ error: "NODE_TYPE_INVALID" }, { status: 400 });
  if (typeof body?.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  const result = await createNode(access!, {
    stageId: id,
    nodeType: body.nodeType,
    title: body.title,
    parentId: typeof body.parentId === "string" ? body.parentId : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    position: typeof body.position === "number" ? body.position : undefined,
    surface: isStageSurface(body.surface) ? body.surface : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data, { status: 201 });
}
