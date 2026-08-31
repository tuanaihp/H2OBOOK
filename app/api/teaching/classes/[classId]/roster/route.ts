import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { getClassRoster } from "@/lib/student-competency/service";
import { enrollAcademyStudent, listAcademyStudentCandidates, updateClassMemberStatus } from "@/lib/teaching/classes";

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  const [roster, candidates] = await Promise.all([
    getClassRoster(access!, classId),
    listAcademyStudentCandidates(access!, classId)
  ]);
  if (roster === null) return NextResponse.json({ error: "FORBIDDEN_CLASS_SCOPE" }, { status: 403 });
  return NextResponse.json({ roster, candidates: candidates ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  const body = await request.json().catch(() => null) as { studentId?: string } | null;
  if (!body?.studentId) return NextResponse.json({ error: "STUDENT_ID_REQUIRED" }, { status: 400 });
  const result = await enrollAcademyStudent(access!, classId, body.studentId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error.includes("FORBIDDEN") ? 403 : result.error.includes("NOT_FOUND") ? 404 : 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  const body = await request.json().catch(() => null) as { studentId?: string; status?: "active" | "paused" | "completed" | "removed" } | null;
  if (!body?.studentId || !body.status || !["active", "paused", "completed", "removed"].includes(body.status)) return NextResponse.json({ error: "VALID_STUDENT_STATUS_REQUIRED" }, { status: 400 });
  const result = await updateClassMemberStatus(access!, classId, body.studentId, body.status);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error.includes("FORBIDDEN") ? 403 : result.error.includes("NOT_FOUND") ? 404 : 400 });
  return NextResponse.json({ ok: true });
}
