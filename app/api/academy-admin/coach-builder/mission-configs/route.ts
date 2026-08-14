import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { upsertMissionConfig, type MissionConfigInput } from "@/lib/h2o-coach/admin";

type Body = MissionConfigInput & { profileVersionId?: string; missionId?: string };

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.profileVersionId || !body.missionId) return NextResponse.json({ error: "PROFILE_VERSION_AND_MISSION_REQUIRED" }, { status: 400 });
  const result = await upsertMissionConfig(access!, body.profileVersionId, body.missionId, {
    objective: body.objective ?? "", requiredFields: body.requiredFields ?? [], questions: body.questions ?? [], tools: body.tools ?? [], resultTemplate: body.resultTemplate
  });
  return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
}
