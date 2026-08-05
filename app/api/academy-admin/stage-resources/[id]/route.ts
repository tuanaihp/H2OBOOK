import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { detachResource, updateResource } from "@/lib/career-stages/admin";
import { isStageResourceAccess, isStageStatus } from "@/lib/career-stages/types";

// Resource rows are addressed by their own id rather than nested under the stage, so the edit and
// detach calls do not have to care which stage a row currently sits in.

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });
  // resourceType/resourceId are omitted on purpose: what a row points at is fixed when it is
  // attached. Repointing it means detaching and attaching again, so the unique constraint still
  // catches a duplicate rather than a silent overwrite.
  const result = await updateResource(access!, id, {
    title: typeof body.title === "string" ? body.title : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    href: typeof body.href === "string" ? body.href : undefined,
    position: typeof body.position === "number" ? body.position : undefined,
    access: isStageResourceAccess(body.access) ? body.access : undefined,
    status: isStageStatus(body.status) ? body.status : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const result = await detachResource(access!, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
