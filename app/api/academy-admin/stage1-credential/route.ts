import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { checkStage1Eligibility, issueStage1CertificateIfEligible } from "@/lib/stage1-learning-os/credential";
import { resolveStage1Id } from "@/lib/stage1-learning-os/stage";

// Owner/admin/teacher only (resolveAcademyAdminAccess) — certificate_issues has no student
// self-insert RLS policy at all (migration 0025), issuance is deliberately staff-triggered.
export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "STUDENT_REQUIRED" }, { status: 400 });
  const stageId = url.searchParams.get("stageId") ?? await resolveStage1Id(access!.organizationId);
  if (!stageId) return NextResponse.json({ error: "STAGE_NOT_FOUND" }, { status: 400 });
  const eligibility = await checkStage1Eligibility(access!.organizationId, studentId, stageId);
  return NextResponse.json({ stageId, ...eligibility });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as { studentId?: string; stageId?: string } | null;
  if (!body?.studentId) return NextResponse.json({ error: "STUDENT_REQUIRED" }, { status: 400 });
  const stageId = body.stageId ?? await resolveStage1Id(access!.organizationId);
  if (!stageId) return NextResponse.json({ error: "STAGE_NOT_FOUND" }, { status: 400 });
  const result = await issueStage1CertificateIfEligible(access!, body.studentId, stageId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data);
}
