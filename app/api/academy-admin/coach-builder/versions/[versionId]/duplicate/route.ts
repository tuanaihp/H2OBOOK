import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { duplicateProfileVersion } from "@/lib/h2o-coach/admin";

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { versionId } = await params;
  const body = await request.json().catch(() => null) as { profileId?: string } | null;
  if (!body?.profileId) return NextResponse.json({ error: "PROFILE_ID_REQUIRED" }, { status: 400 });
  const result = await duplicateProfileVersion(access!, body.profileId, versionId);
  return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
}
