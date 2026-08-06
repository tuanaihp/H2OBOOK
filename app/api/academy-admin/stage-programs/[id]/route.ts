import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { archiveProgram, updateProgram } from "@/lib/career-stages/admin";
import { isStageStatus } from "@/lib/career-stages/types";

// Program rows are addressed by their own id rather than nested under the stage, matching the
// stage-resources/[id] pattern — a program never changes which stage it belongs to after creation.

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });
  const result = await updateProgram(access!, id, {
    title: typeof body.title === "string" ? body.title : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    parentId: typeof body.parentId === "string" ? body.parentId : body.parentId === null ? null : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    position: typeof body.position === "number" ? body.position : undefined,
    status: isStageStatus(body.status) ? body.status : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const result = await archiveProgram(access!, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
