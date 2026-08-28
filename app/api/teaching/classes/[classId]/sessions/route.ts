import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { listClassSessions, createClassSessions, seedCurriculumSessions, type CreateSessionInput } from "@/lib/student-competency/service";

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  const sessions = await listClassSessions(access!, classId);
  if (sessions === null) return NextResponse.json({ error: "FORBIDDEN_CLASS_SCOPE" }, { status: 403 });
  return NextResponse.json({ sessions });
}

// POST { seedCurriculum: true } fills the standard 60-session curriculum shape; POST { sessions:
// [...] } adds specific sessions instead — kept as one endpoint so the "Tổng quan" tab's one-click
// setup and any future manual add share the same authorization/insert path.
export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  const body = await request.json().catch(() => null) as { seedCurriculum?: boolean; sessions?: CreateSessionInput[] } | null;

  if (body?.seedCurriculum) {
    const result = await seedCurriculumSessions(access!, classId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "FORBIDDEN_CLASS_SCOPE" ? 403 : 400 });
    return NextResponse.json({ ok: true, count: result.count }, { status: 201 });
  }

  if (!body?.sessions?.length) return NextResponse.json({ error: "NO_SESSIONS" }, { status: 400 });
  const result = await createClassSessions(access!, classId, body.sessions);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "FORBIDDEN_CLASS_SCOPE" ? 403 : 400 });
  return NextResponse.json({ ok: true, count: result.count }, { status: 201 });
}
