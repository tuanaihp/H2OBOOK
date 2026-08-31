import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { getClassStudentDetail } from "@/lib/student-competency/service";

export async function GET(request: Request, { params }: { params: Promise<{ classId: string; studentId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId, studentId } = await params;
  const student = await getClassStudentDetail(access!, classId, studentId);
  if (!student) return NextResponse.json({ error: "STUDENT_NOT_FOUND_OR_FORBIDDEN" }, { status: 404 });
  return NextResponse.json({ student });
}
