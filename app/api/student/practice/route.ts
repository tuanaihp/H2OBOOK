import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { listDailyPracticeEntries, saveDailyPracticeEntry } from "@/lib/stage1-learning-os/daily-practice";

type Body = { missionId?: string; textNote?: string; assetIds?: string[]; tags?: string[] };

// Daily Practice Journal (docs/stage1-learning-os-v1) — same auth/org shape every other
// /api/student/journey/* write route already uses.
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const missionId = new URL(request.url).searchParams.get("missionId") ?? undefined;
  const entries = await listDailyPracticeEntries(organizationId, auth.user!.id, missionId);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.missionId || !body.textNote?.trim()) return NextResponse.json({ error: "PRACTICE_REQUIRED" }, { status: 400 });
  const result = await saveDailyPracticeEntry(organizationId, auth.user!.id, { missionId: body.missionId, textNote: body.textNote, assetIds: body.assetIds, tags: body.tags });
  return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
}
