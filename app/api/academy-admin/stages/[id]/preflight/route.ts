import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { runStagePreflight } from "@/lib/academy-control/health";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const result = await runStagePreflight(access!.organizationId, id);
  return NextResponse.json(result);
}
