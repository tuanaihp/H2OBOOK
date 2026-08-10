import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { completeSelfReportedMission, startMission } from "@/lib/learn-outcome/student";

type Body = { action?: "start" | "completeSelf"; missionId?: string; blueprintVersionId?: string };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });

  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.missionId || !body?.blueprintVersionId) return NextResponse.json({ error: "MISSION_AND_VERSION_REQUIRED" }, { status: 400 });

  if (body.action === "completeSelf") {
    const result = await completeSelfReportedMission(auth.user!.id, organizationId, body.missionId, body.blueprintVersionId);
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
  }
  const result = await startMission(auth.user!.id, organizationId, body.missionId, body.blueprintVersionId);
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: 400 });
}
