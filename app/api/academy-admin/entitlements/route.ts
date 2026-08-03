import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { grantManualEntitlement, listManualGrants, type ManualGrantInput } from "@/lib/academy-admin/entitlements";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const url = new URL(request.url);
  const grants = await listManualGrants(access!, url.searchParams.get("resourceType") ?? undefined, url.searchParams.get("resourceId") ?? undefined);
  return NextResponse.json({ grants });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Partial<ManualGrantInput> | null;
  if (!body?.userId || !body.resourceType || !body.resourceId || !body.reason?.trim()) {
    return NextResponse.json({ error: "USER_RESOURCE_REASON_REQUIRED" }, { status: 400 });
  }
  const result = await grantManualEntitlement(access!, { userId: body.userId, resourceType: body.resourceType, resourceId: body.resourceId, expiresAt: body.expiresAt, reason: body.reason });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
