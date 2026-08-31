import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { listSessionSubmissions } from "@/lib/student-competency/service";

// Instructor-side read of a student's pre-grading evidence, surfaced in the grading form so the
// score is anchored to what the student actually submitted.
export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  const studentId = new URL(request.url).searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "STUDENT_ID_REQUIRED" }, { status: 400 });

  const submissions = await listSessionSubmissions(access!, classId, studentId);
  if (submissions === null) return NextResponse.json({ error: "FORBIDDEN_SCOPE" }, { status: 403 });
  return NextResponse.json({ submissions });
}
