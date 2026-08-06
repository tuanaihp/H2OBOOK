import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getStudentAssignments, submitAssignment } from "@/lib/student/assignments";

// The student id always comes from the session, never from the body — a submission endpoint that
// accepted a user id would let anyone file work under someone else's name.

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const user = await getCurrentUser();
  const organizationId = await configuredAcademyOrganizationId();
  if (!user || user.demo || !organizationId) return NextResponse.json({ mode: "demo", assignments: [] });
  return NextResponse.json({ mode: "production", assignments: await getStudentAssignments(user.id, organizationId) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const user = await getCurrentUser();
  const organizationId = await configuredAcademyOrganizationId();
  if (!user || user.demo || !organizationId) return NextResponse.json({ error: "DEMO_MODE" }, { status: 400 });

  const body = await request.json().catch(() => null) as { assignmentId?: string; textResponse?: string; assetIds?: string[] } | null;
  if (!body?.assignmentId) return NextResponse.json({ error: "ASSIGNMENT_REQUIRED" }, { status: 400 });

  const result = await submitAssignment(user.id, organizationId, body.assignmentId, {
    textResponse: typeof body.textResponse === "string" ? body.textResponse : "",
    assetIds: Array.isArray(body.assetIds) ? body.assetIds.map(String) : []
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
