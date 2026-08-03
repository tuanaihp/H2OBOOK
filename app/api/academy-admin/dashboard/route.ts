import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { getAcademyDashboardSummary } from "@/lib/academy-admin/dashboard";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const summary = await getAcademyDashboardSummary(access!);
  return NextResponse.json(summary);
}
