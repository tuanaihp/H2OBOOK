import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { listEvaluationAudit } from "@/lib/student-competency/service";

export async function GET(request: Request, { params }: { params: Promise<{ classId: string; evaluationId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId, evaluationId } = await params;
  const entries = await listEvaluationAudit(access!, classId, evaluationId);
  if (entries === null) return NextResponse.json({ error: "FORBIDDEN_EVALUATION_SCOPE" }, { status: 403 });
  return NextResponse.json({ entries });
}
