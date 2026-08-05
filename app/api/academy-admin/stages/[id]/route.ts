import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { archiveStage, updateStage } from "@/lib/career-stages/admin";
import { isStageStatus } from "@/lib/career-stages/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });
  const result = await updateStage(access!, id, {
    title: typeof body.title === "string" ? body.title : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    position: typeof body.position === "number" ? body.position : undefined,
    indexLabel: typeof body.indexLabel === "string" ? body.indexLabel : undefined,
    subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    durationLabel: typeof body.durationLabel === "string" ? body.durationLabel : undefined,
    skills: Array.isArray(body.skills) ? body.skills.map(String) : undefined,
    status: isStageStatus(body.status) ? body.status : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const result = await archiveStage(access!, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
