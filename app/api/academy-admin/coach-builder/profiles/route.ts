import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { getOrCreateProfile, listStageProfiles } from "@/lib/h2o-coach/admin";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const stages = await listStageProfiles(access!);
  return NextResponse.json({ stages });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as { stageId?: string } | null;
  if (!body?.stageId) return NextResponse.json({ error: "STAGE_ID_REQUIRED" }, { status: 400 });
  const result = await getOrCreateProfile(access!, body.stageId);
  return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
}
