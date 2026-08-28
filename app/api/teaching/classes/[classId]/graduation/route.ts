import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { getGraduationForStudent } from "@/lib/student-competency/service";

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "STUDENT_ID_REQUIRED" }, { status: 400 });
  const supplementParam = url.searchParams.get("supplementSessions");
  const supplementSessionsConfig = supplementParam ? Number(supplementParam) : undefined;

  const graduation = await getGraduationForStudent(access!, classId, studentId, { supplementSessionsConfig });
  if (graduation === null) return NextResponse.json({ error: "FORBIDDEN_SCOPE" }, { status: 403 });
  return NextResponse.json({ graduation });
}
