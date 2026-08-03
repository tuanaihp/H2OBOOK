import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { createIntervention, type CreateInterventionInput } from "@/lib/teaching/interventions";

export async function POST(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Partial<CreateInterventionInput> | null;
  if (!body?.studentId || !body.riskLevel || !body.actionType) {
    return NextResponse.json({ error: "STUDENT_RISK_ACTION_REQUIRED" }, { status: 400 });
  }
  const result = await createIntervention(access!, {
    studentId: body.studentId,
    classId: body.classId,
    riskLevel: body.riskLevel,
    reasonCodes: body.reasonCodes ?? [],
    actionType: body.actionType,
    note: body.note,
    dueAt: body.dueAt
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
