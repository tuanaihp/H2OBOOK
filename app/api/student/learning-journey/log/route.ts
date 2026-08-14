import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { createDailyLogEntry, listDailyLogEntries } from "@/lib/learning-journey/service";
import type { DailyLogInput } from "@/lib/learning-journey/types";

// Learning Journey Intelligence V1 Daily Log — same auth/org shape every /api/student/journey/*
// write route already uses. Separate from /api/student/practice (the folder-36 compatibility
// facade, kept unchanged) — this is the richer V1 surface (skill tags, self score, best result,
// suspected reason) backed by the same learner_experiences rows.
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const missionId = new URL(request.url).searchParams.get("missionId") ?? undefined;
  const entries = await listDailyLogEntries(organizationId, auth.user!.id, missionId);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const body = await request.json().catch(() => null) as Partial<DailyLogInput> | null;
  if (!body?.missionId || !body.practicedToday?.trim()) return NextResponse.json({ error: "MISSION_AND_PRACTICE_REQUIRED" }, { status: 400 });
  const result = await createDailyLogEntry(organizationId, auth.user!.id, {
    missionId: body.missionId, practicedToday: body.practicedToday, bestResult: body.bestResult,
    problemText: body.problemText, suspectedReason: body.suspectedReason, nextAction: body.nextAction,
    practiceMinutes: body.practiceMinutes, selfScore: body.selfScore, assetIds: body.assetIds, skillKeys: body.skillKeys
  });
  return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
}
