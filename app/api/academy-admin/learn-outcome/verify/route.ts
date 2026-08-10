import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { teacherVerifyMission } from "@/lib/learn-outcome/student";

type Body = { organizationId?: string; studentId?: string; missionId?: string; blueprintVersionId?: string; approve?: boolean };

// Owner/admin/teacher — deliberately not resolveAcademyAdminAccess, which only allows owner/admin.
// Teacher verify (docs/learn-outcome-os Release B, mission.completion_policy='teacher_verified') is
// exactly the review step a teacher — not only an academy admin — needs to perform, matching the
// same role set migration 0051's RLS policy already trusts for this write.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.studentId || !body?.missionId || !body?.blueprintVersionId) return NextResponse.json({ error: "STUDENT_MISSION_VERSION_REQUIRED" }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner", "admin", "teacher"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const result = await teacherVerifyMission({ organizationId: access.organizationId, userId: auth.user!.id }, body.studentId, body.missionId, body.blueprintVersionId, body.approve !== false);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
