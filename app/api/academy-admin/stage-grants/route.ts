import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { grantManualStageAccess, listManualStageGrants, type StageGrantInput } from "@/lib/academy-admin/entitlements";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const grants = await listManualStageGrants(access!);
  return NextResponse.json({ grants });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Partial<StageGrantInput> | null;
  if (!body?.userId || !body.stageSlug || !body.reason?.trim()) return NextResponse.json({ error: "USER_STAGE_REASON_REQUIRED" }, { status: 400 });
  const result = await grantManualStageAccess(access!, { userId: body.userId, stageSlug: body.stageSlug, expiresAt: body.expiresAt, reason: body.reason });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
