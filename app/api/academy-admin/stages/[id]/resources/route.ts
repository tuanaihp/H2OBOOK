import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { attachResource } from "@/lib/career-stages/admin";
import { isRequirementType, isStageResourceAccess, isStageResourceType, isUnlockMode, toDisplayLocations } from "@/lib/career-stages/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!isStageResourceType(body?.resourceType)) return NextResponse.json({ error: "RESOURCE_TYPE_INVALID" }, { status: 400 });
  if (typeof body?.resourceId !== "string" || !body.resourceId.trim()) return NextResponse.json({ error: "RESOURCE_ID_REQUIRED" }, { status: 400 });
  const result = await attachResource(access!, id, {
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    title: typeof body.title === "string" ? body.title : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    href: typeof body.href === "string" ? body.href : undefined,
    access: isStageResourceAccess(body.access) ? body.access : undefined,
    unlockMode: isUnlockMode(body.unlockMode) ? body.unlockMode : undefined,
    requirementType: isRequirementType(body.requirementType) ? body.requirementType : undefined,
    displayLocations: toDisplayLocations(body.displayLocations)
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data, { status: 201 });
}
