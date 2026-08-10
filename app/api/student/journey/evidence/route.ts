import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { submitEvidenceForStudent } from "@/lib/mission-workspace/student";

// Same trust boundary as the mission route: the journey version is resolved server-side and a
// locked/unreachable mission is rejected before any write.
type Body = { missionId?: string; note?: string; assetId?: string };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.missionId || (!body.note?.trim() && !body.assetId)) return NextResponse.json({ error: "EVIDENCE_REQUIRED" }, { status: 400 });
  const result = await submitEvidenceForStudent(auth.user!.id, organizationId, body.missionId, { note: body.note, assetId: body.assetId });
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
