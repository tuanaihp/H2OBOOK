import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { getResourceDataLink } from "@/lib/academy-data-link/service";

// Resource Data Link Inspector + Mission Resource Origin. Always resourceType+resourceId, never a
// raw UUID typed by Admin — the caller is expected to have picked the resource from a real list
// (Stage Curriculum resource row, or a Mission's resource binding), which already carries both.
export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const url = new URL(request.url);
  const resourceType = url.searchParams.get("resourceType");
  const resourceId = url.searchParams.get("resourceId");
  if (!resourceType || !resourceId) return NextResponse.json({ error: "RESOURCE_REQUIRED" }, { status: 400 });

  const resource = await getResourceDataLink(access!.organizationId, resourceType, resourceId);
  if (!resource) return NextResponse.json({ error: "RESOURCE_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ resource });
}
