import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { autoGenerateMissionConfig } from "@/lib/h2o-coach/admin";

type Body = { profileVersionId?: string; missionId?: string };

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.profileVersionId || !body.missionId) return NextResponse.json({ error: "PROFILE_VERSION_AND_MISSION_REQUIRED" }, { status: 400 });
  const result = await autoGenerateMissionConfig(access!, body.profileVersionId, body.missionId);
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: 400 });
}
