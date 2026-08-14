import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { listMissionsForStage } from "@/lib/h2o-coach/admin";

export async function GET(request: Request, { params }: { params: Promise<{ stageId: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { stageId } = await params;
  const missions = await listMissionsForStage(access!, stageId);
  return NextResponse.json({ missions });
}
