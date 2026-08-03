import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { gradeLegacySubmission, type GradeLegacySubmissionInput } from "@/lib/teaching/grading";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Partial<GradeLegacySubmissionInput> | null;
  if (!body || typeof body.score !== "number" || typeof body.feedback !== "string" || !body.decision) {
    return NextResponse.json({ error: "SCORE_FEEDBACK_DECISION_REQUIRED" }, { status: 400 });
  }
  const result = await gradeLegacySubmission(access!, id, { score: body.score, feedback: body.feedback, decision: body.decision });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "SUBMISSION_NOT_FOUND" ? 404 : result.error === "FORBIDDEN_STUDENT_SCOPE" ? 403 : 400 });
  return NextResponse.json(result);
}
