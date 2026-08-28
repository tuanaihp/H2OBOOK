import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { canAccessClass } from "@/lib/teaching/access";
import { listEvaluationsForStudent, upsertEvaluation, type UpsertEvaluationInput } from "@/lib/student-competency/service";

// classId in the path scopes authorization (via canAccessClass below); the actual filter is
// studentId, since evaluation history is read per-student across every class they belong to would
// be a different endpoint — this one intentionally stays class-scoped to match the calling UI
// (the class detail page never shows a student's evaluations from another class here).
export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  if (!canAccessClass(access!, classId)) return NextResponse.json({ error: "FORBIDDEN_CLASS_SCOPE" }, { status: 403 });
  const studentId = new URL(request.url).searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "STUDENT_ID_REQUIRED" }, { status: 400 });
  const evaluations = await listEvaluationsForStudent(access!, classId, studentId);
  if (evaluations === null) return NextResponse.json({ error: "FORBIDDEN_STUDENT_SCOPE" }, { status: 403 });
  return NextResponse.json({ evaluations });
}

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  if (!canAccessClass(access!, classId)) return NextResponse.json({ error: "FORBIDDEN_CLASS_SCOPE" }, { status: 403 });
  const body = await request.json().catch(() => null) as Partial<UpsertEvaluationInput> | null;
  if (!body?.classSessionId || !body.studentId || !body.rubricId || !body.criterionScores) {
    return NextResponse.json({ error: "EVALUATION_FIELDS_REQUIRED" }, { status: 400 });
  }
  const result = await upsertEvaluation(access!, {
    classSessionId: body.classSessionId, studentId: body.studentId, rubricId: body.rubricId,
    criterionScores: body.criterionScores, notes: body.notes, assetIds: body.assetIds
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error.includes("FORBIDDEN") ? 403 : result.error.includes("NOT_FOUND") ? 404 : 400 });
  return NextResponse.json({ ok: true, evaluation: result.evaluation }, { status: 201 });
}
