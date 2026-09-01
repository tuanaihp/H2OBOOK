import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getStudentSessionAiContext, listOwnAiAssessments } from "@/lib/student-competency/service";
import { chatWithCoach } from "@/lib/h2obook/ai/adapter";
import type { CoachChatMessage } from "@/lib/h2obook/ai/types";

export const runtime = "nodejs";

// H2O Learning Copilot — lesson-scoped chat. Stateless (v1): the client holds the transcript.
// Never produces an official score.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ reply: "Chế độ demo — đăng nhập tài khoản học viên thật để dùng AI Coach." });

  const body = await request.json().catch(() => null) as { classSessionId?: string; messages?: unknown } | null;
  if (!body?.classSessionId || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "CLASS_SESSION_ID_AND_MESSAGES_REQUIRED" }, { status: 400 });
  }
  const messages: CoachChatMessage[] = body.messages
    .filter((m): m is { role: string; content: string } => Boolean(m && typeof m === "object" && "content" in m))
    .map((m): CoachChatMessage => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 2000) }))
    .slice(-12);
  if (!messages.length) return NextResponse.json({ error: "NO_MESSAGE" }, { status: 400 });

  const ctx = await getStudentSessionAiContext(auth.user!.id, body.classSessionId);
  if (!ctx.ok) {
    const status = ctx.error === "STUDENT_NOT_IN_CLASS" ? 403 : ctx.error === "SESSION_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: ctx.error }, { status });
  }

  const latest = (await listOwnAiAssessments(auth.user!.id, ctx.context.classId))
    .find((a) => a.classSessionId === body.classSessionId && a.status === "ai_draft");

  const reply = await chatWithCoach({
    sessionTitle: ctx.context.sessionTitle,
    rubric: ctx.context.rubric,
    latestAssessment: latest
      ? {
          totalScore: latest.totalScore ?? 0,
          maxScore: latest.maxScore,
          summary: latest.summary,
          priorityFixes: latest.priorityFixes,
          criteria: Object.entries(latest.criterionScores).map(([criterionId, v]) => ({ criterionId, ...v })),
          provider: latest.provider as never,
          model: latest.model,
          analyzedAt: latest.createdAt,
        }
      : null,
    messages,
  });

  return NextResponse.json({ reply: reply?.reply ?? "AI Coach tạm thời không phản hồi được. Em thử lại sau nhé — bài nộp của em vẫn được giữ nguyên." });
}
