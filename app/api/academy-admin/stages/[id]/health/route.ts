import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { computeStageHealth } from "@/lib/academy-control/health";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const health = await computeStageHealth(access!.organizationId, id);
  return NextResponse.json(health);
}
