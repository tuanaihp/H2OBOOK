import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { reviewOutcomeProject } from "@/lib/teaching/grading";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { decision?: "approved" | "in_progress"; note?: string } | null;
  if (!body?.decision || !["approved", "in_progress"].includes(body.decision)) {
    return NextResponse.json({ error: "DECISION_REQUIRED" }, { status: 400 });
  }
  const result = await reviewOutcomeProject(access!, id, body.decision, body.note ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "PROJECT_NOT_FOUND" ? 404 : result.error === "FORBIDDEN_STUDENT_SCOPE" ? 403 : 400 });
  return NextResponse.json(result);
}
