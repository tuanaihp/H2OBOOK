import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getCoachSessionState } from "@/lib/h2o-coach/service";

// Opens the H2O Coach Workspace for one Mission — profile/mission config/memory/message history.
// Returns { session: null } (not an error) when the Stage has no published Coach profile or this
// Mission has no coaching config on it — the client falls back to the 4-tab Mission Workspace,
// exactly as docs/h2o-coach-v1's "no demo/fake data in production" rule requires.
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const missionId = new URL(request.url).searchParams.get("missionId");
  if (!missionId) return NextResponse.json({ error: "MISSION_ID_REQUIRED" }, { status: 400 });
  const session = await getCoachSessionState(organizationId, auth.user!.id, missionId);
  return NextResponse.json({ session });
}
