import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { upsertOwnSessionSubmission } from "@/lib/student-competency/service";

// Student saves / updates their own evidence for one session. student_id is always the
// authenticated user — never taken from the body — and the RLS policy in migration 0063 is the
// real gate.
export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ error: "DEMO_MODE_READ_ONLY" }, { status: 403 });

  const body = await request.json().catch(() => null) as { classSessionId?: string; assetIds?: unknown; note?: unknown; rubricId?: unknown; criterionScores?: unknown; durationMinutes?: unknown } | null;
  if (!body?.classSessionId) return NextResponse.json({ error: "CLASS_SESSION_ID_REQUIRED" }, { status: 400 });
  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.filter((id): id is string => typeof id === "string") : [];
  const note = typeof body.note === "string" ? body.note : "";
  const rubricId = typeof body.rubricId === "string" ? body.rubricId : undefined;
  const criterionScores = body.criterionScores && typeof body.criterionScores === "object" && !Array.isArray(body.criterionScores)
    ? Object.fromEntries(Object.entries(body.criterionScores).filter(([, score]) => typeof score === "number" && Number.isFinite(score))) as Record<string, number>
    : undefined;
  const durationMinutes = typeof body.durationMinutes === "number" && Number.isFinite(body.durationMinutes) ? body.durationMinutes : undefined;

  const result = await upsertOwnSessionSubmission(auth.user!.id, { classSessionId: body.classSessionId, assetIds, note, rubricId, criterionScores, durationMinutes });
  if (!result.ok) {
    const status = result.error === "STUDENT_NOT_IN_CLASS" ? 403 : result.error === "SESSION_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, submission: result.submission });
}
