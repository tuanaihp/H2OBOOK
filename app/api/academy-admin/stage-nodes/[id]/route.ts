import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { archiveNode, updateNode } from "@/lib/academy-control/admin";
import { isStageSurface } from "@/lib/academy-control/types";

// Node rows are addressed by their own id, matching stage-resources/[id] — a node never changes
// which stage it belongs to after creation.

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });
  const result = await updateNode(access!, id, {
    title: typeof body.title === "string" ? body.title : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    position: typeof body.position === "number" ? body.position : undefined,
    status: body.status === "active" || body.status === "hidden" || body.status === "archived" ? body.status : undefined,
    // "" clears the declared surface so the node falls back to inheriting from its parent.
    surface: isStageSurface(body.surface) ? body.surface : body.surface === null || body.surface === "" ? null : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const result = await archiveNode(access!, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
