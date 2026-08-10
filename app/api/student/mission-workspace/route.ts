import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getMissionWorkspaceView, saveMissionBlockValue } from "@/lib/mission-workspace/student";

// The Universal Mission Workspace read model (Journey context + Mission + Workspace blocks +
// this student's own saved values + deterministic readiness) — one call for the whole
// /student/missions/[missionId] route, same shape the server component uses so client-side
// refetches (after a block save, action toggle, evidence submit) stay in sync automatically.
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId || auth.user!.demo) return NextResponse.json({ view: null });

  const missionId = new URL(request.url).searchParams.get("missionId");
  if (!missionId) return NextResponse.json({ error: "MISSION_ID_REQUIRED" }, { status: 400 });

  const view = await getMissionWorkspaceView(auth.user!.id, organizationId, missionId);
  return NextResponse.json({ view });
}

type Body = { missionId?: string; blockId?: string; value?: unknown; status?: "draft" | "saved" };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });

  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.missionId || !body?.blockId) return NextResponse.json({ error: "MISSION_AND_BLOCK_REQUIRED" }, { status: 400 });

  const result = await saveMissionBlockValue(auth.user!.id, organizationId, body.missionId, body.blockId, body.value, body.status ?? "saved");
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
