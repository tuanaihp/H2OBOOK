import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { upgradeCurriculumContentV2 } from "@/lib/curriculum/upgrade-content-v2";

export const maxDuration = 60;

// Upgrades the six-stage curriculum's 80 documents from V1's shared template into real per-resource
// content (v5/26-H2OBOOK_CURRICULUM_CONTENT_V2_PRODUCTION). Every key it touches must already exist —
// this never creates a stage, node, document or placement, only enriches ones lib/curriculum/seed.ts
// already made. Safe to call repeatedly: a document already at content_version 2 is left untouched, so
// a second run reports everything as `alreadyCurrent` and changes nothing.
export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const report = await upgradeCurriculumContentV2({
    organizationId: access!.organizationId,
    actorUserId: access!.userId,
    dryRun: body?.dryRun === true
  });
  return NextResponse.json(report, { status: report.warnings.length ? 207 : 200 });
}
