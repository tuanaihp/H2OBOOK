import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { canAccessStudent } from "@/lib/teaching/access";
import { getAssignedStudentSummaries, getStudentInterventions } from "@/lib/teaching/students";

// A miss here must look identical for "unassigned student" and "student doesn't exist" — 404 in
// both cases — so this endpoint can never be used to enumerate students outside the caller's
// scope (CLAUDE_INTEGRATION_PROMPT.md §D).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { id } = await params;
  if (!canAccessStudent(access!, id)) return NextResponse.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });

  const [summaries, interventions] = await Promise.all([
    getAssignedStudentSummaries(access!),
    getStudentInterventions(access!, id)
  ]);
  const summary = summaries.find((row) => row.studentId === id);
  if (!summary) return NextResponse.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ student: summary, interventions });
}
