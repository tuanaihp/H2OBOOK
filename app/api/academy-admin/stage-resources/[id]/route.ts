import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { detachResource, updateResource } from "@/lib/career-stages/admin";
import { isRequirementType, isStageResourceAccess, isStageStatus, isStageSurfaceTag, isUnlockMode, toDisplayLocations } from "@/lib/career-stages/types";

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
    status: isStageStatus(body.status) ? body.status : undefined,
    unlockMode: isUnlockMode(body.unlockMode) ? body.unlockMode : undefined,
    // "" clears the prerequisite; undefined leaves it untouched. Distinguishing the two matters,
    // otherwise a form that omits the field would silently wipe an existing rule.
    prerequisiteBindingId: typeof body.prerequisiteBindingId === "string" ? body.prerequisiteBindingId : undefined,
    requiredProgress: typeof body.requiredProgress === "number" ? body.requiredProgress : body.requiredProgress === null ? null : undefined,
    unlockAt: typeof body.unlockAt === "string" ? body.unlockAt : body.unlockAt === null ? null : undefined,
    requirementType: isRequirementType(body.requirementType) ? body.requirementType : undefined,
    displayLocations: toDisplayLocations(body.displayLocations),
    // "" clears the grouping (moves the resource back to ungrouped); undefined leaves it untouched.
    programId: typeof body.programId === "string" ? body.programId || null : body.programId === null ? null : undefined,
    nodeId: typeof body.nodeId === "string" ? body.nodeId || null : body.nodeId === null ? null : undefined,
    surface: isStageSurfaceTag(body.surface) ? body.surface : body.surface === null ? null : undefined,
    isFeatured: typeof body.isFeatured === "boolean" ? body.isFeatured : undefined
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
