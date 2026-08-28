import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { canAccessClass } from "@/lib/teaching/access";
import { getCompetencyForStudent } from "@/lib/student-competency/service";

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  if (!canAccessClass(access!, classId)) return NextResponse.json({ error: "FORBIDDEN_CLASS_SCOPE" }, { status: 403 });
  const studentId = new URL(request.url).searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "STUDENT_ID_REQUIRED" }, { status: 400 });
  const profile = await getCompetencyForStudent(access!, studentId);
  if (profile === null) return NextResponse.json({ error: "FORBIDDEN_STUDENT_SCOPE" }, { status: 403 });
  return NextResponse.json({ profile });
}
