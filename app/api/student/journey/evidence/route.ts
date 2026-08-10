import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { submitEvidence } from "@/lib/learn-outcome/student";

type Body = { missionId?: string; blueprintVersionId?: string; note?: string; assetId?: string };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.missionId || !body?.blueprintVersionId || (!body.note?.trim() && !body.assetId)) return NextResponse.json({ error: "EVIDENCE_REQUIRED" }, { status: 400 });
  const result = await submitEvidence(auth.user!.id, organizationId, body.missionId, body.blueprintVersionId, { note: body.note, assetId: body.assetId });
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
