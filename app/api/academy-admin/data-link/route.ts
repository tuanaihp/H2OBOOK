import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { getSetupGuideState, getStageLinkHealth } from "@/lib/academy-data-link/service";

// Data Link Overview + Setup Guide for one Stage — both computed from the same batched facts
// (lib/academy-data-link/service.ts's loadStageFacts), so this is one request, not two.
export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const stageId = new URL(request.url).searchParams.get("stageId");
  if (!stageId) return NextResponse.json({ error: "STAGE_REQUIRED" }, { status: 400 });

  const [health, guide] = await Promise.all([
    getStageLinkHealth(access!.organizationId, stageId),
    getSetupGuideState(access!.organizationId, stageId)
  ]);
  return NextResponse.json({ health, guide });
}
