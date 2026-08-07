import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { attachCatalogResource } from "@/lib/academy-control/admin";
import { isStageSurface } from "@/lib/academy-control/types";

// Attaches a resource picked from the content catalog (Kho nội dung Academy), as opposed to
// stages/[id]/resources which attaches by hand-typed resourceType/resourceId (still needed for
// academy_courses, which is deliberately not in the catalog — see docs/academy-control-center-v2-architecture-plan.md).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (typeof body?.contentItemId !== "string" || !body.contentItemId) return NextResponse.json({ error: "CONTENT_ITEM_ID_REQUIRED" }, { status: 400 });
  const result = await attachCatalogResource(access!, {
    stageId: id,
    contentItemId: body.contentItemId,
    nodeId: typeof body.nodeId === "string" ? body.nodeId : undefined,
    surface: isStageSurface(body.surface) ? body.surface : undefined,
    isFeatured: typeof body.isFeatured === "boolean" ? body.isFeatured : undefined,
    position: typeof body.position === "number" ? body.position : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data, { status: 201 });
}
