import { NextResponse } from "next/server";
import { resolveBusinessAccess } from "@/lib/business/request";
import { buildBusinessCommandCenterSummary } from "@/lib/business/summary";

export async function GET(request: Request) {
  const { access, response } = await resolveBusinessAccess(request);
  if (response) return response;
  const summary = await buildBusinessCommandCenterSummary(access!);
  return NextResponse.json({ ...summary, plan: access!.plan, activeMembership: access!.activeMembership });
}
