import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { listProfileVersions } from "@/lib/h2o-coach/admin";

export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { profileId } = await params;
  const versions = await listProfileVersions(access!, profileId);
  return NextResponse.json({ versions });
}
