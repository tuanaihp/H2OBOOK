import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { handleCoachTurn } from "@/lib/h2o-coach/service";

type Body = { missionId?: string; message?: string };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.missionId || !body.message?.trim()) return NextResponse.json({ error: "MISSION_AND_MESSAGE_REQUIRED" }, { status: 400 });
  const result = await handleCoachTurn({ organizationId, learnerId: auth.user!.id, missionId: body.missionId, learnerMessage: body.message });
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: 400 });
}
