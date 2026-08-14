import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { getProfileVersionDetail, updateProfileVersion, type ProfileVersionPatch } from "@/lib/h2o-coach/admin";

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { versionId } = await params;
  const version = await getProfileVersionDetail(access!, versionId);
  if (!version) return NextResponse.json({ error: "VERSION_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ version });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { versionId } = await params;
  const body = await request.json().catch(() => null) as ProfileVersionPatch | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  const result = await updateProfileVersion(access!, versionId, body);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
