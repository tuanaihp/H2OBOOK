import { NextResponse } from "next/server";
import { resolveSystemAccess } from "@/lib/system/request";
import { calculateHealthScore } from "@/lib/system/health";
import { currentEnvironment, getLiveServiceChecks } from "@/lib/system/live-health";

export async function GET(request: Request) {
  const { access, response } = await resolveSystemAccess(request);
  if (response) return response;
  const checks = await getLiveServiceChecks();
  const result = calculateHealthScore(checks);
  return NextResponse.json({ ...result, environment: currentEnvironment(), role: access!.role });
}
