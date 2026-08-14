import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { grantManualMembership, MEMBERSHIP_PLAN_OPTIONS } from "@/lib/academy-admin/entitlements";

export async function GET(request: Request) {
  const { response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  return NextResponse.json({ plans: MEMBERSHIP_PLAN_OPTIONS });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as { userId?: string; planSlug?: string; expiresAt?: string; reason?: string } | null;
  if (!body?.userId || !body.planSlug || !body.reason?.trim()) return NextResponse.json({ error: "USER_PLAN_REASON_REQUIRED" }, { status: 400 });
  const result = await grantManualMembership(access!, { userId: body.userId, planSlug: body.planSlug, expiresAt: body.expiresAt, reason: body.reason });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
