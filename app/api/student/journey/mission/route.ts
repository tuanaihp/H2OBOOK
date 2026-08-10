import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { completeSelfReportedMissionForStudent, startMissionForStudent } from "@/lib/mission-workspace/student";

// blueprintVersionId is deliberately NOT read from the request any more: the server resolves it
// from the student's own published journey, and rejects a mission that is locked or not reachable
// at all (lib/mission-workspace/student.ts's requireOpenMission). Older clients may still send the
// field — it is ignored rather than trusted.
type Body = { action?: "start" | "completeSelf"; missionId?: string };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });

  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.missionId) return NextResponse.json({ error: "MISSION_REQUIRED" }, { status: 400 });

  if (body.action === "completeSelf") {
    const result = await completeSelfReportedMissionForStudent(auth.user!.id, organizationId, body.missionId);
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
  }
  const result = await startMissionForStudent(auth.user!.id, organizationId, body.missionId);
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: 400 });
}
