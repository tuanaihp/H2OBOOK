import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { gradeBrainSubmission, type GradeBrainSubmissionInput } from "@/lib/teaching/grading";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Partial<GradeBrainSubmissionInput> | null;
  if (!body || typeof body.writtenFeedback !== "string") return NextResponse.json({ error: "WRITTEN_FEEDBACK_REQUIRED" }, { status: 400 });

  const result = await gradeBrainSubmission(access!, id, {
    criteria: body.criteria ?? [],
    writtenFeedback: body.writtenFeedback,
    skillKey: body.skillKey,
    skillScore: body.skillScore,
    learnerReflectionComplete: Boolean(body.learnerReflectionComplete),
    confirmPortfolioReady: Boolean(body.confirmPortfolioReady)
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "SUBMISSION_NOT_FOUND" ? 404 : result.error === "FORBIDDEN_STUDENT_SCOPE" ? 403 : 400 });
  return NextResponse.json(result);
}
