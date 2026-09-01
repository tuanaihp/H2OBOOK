import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getStudentSessionAiContext, saveClassAiAssessment, listOwnAiAssessments } from "@/lib/student-competency/service";
import { analyzeSubmission, describeAiProvider } from "@/lib/h2obook/ai/adapter";
import { createDownloadUrl } from "@/lib/storage/r2";
import { isR2Configured } from "@/lib/runtime-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// AI draft scoring of the student's own session evidence against the teacher rubric. Always a
// DRAFT — never touches class_evaluations. AI failure returns 200 with status "unavailable";
// the student's submission and any official score are untouched.
export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ error: "DEMO_MODE_READ_ONLY" }, { status: 403 });

  const body = await request.json().catch(() => null) as { classSessionId?: string } | null;
  if (!body?.classSessionId) return NextResponse.json({ error: "CLASS_SESSION_ID_REQUIRED" }, { status: 400 });

  const ctx = await getStudentSessionAiContext(auth.user!.id, body.classSessionId);
  if (!ctx.ok) {
    const status = ctx.error === "STUDENT_NOT_IN_CLASS" ? 403 : ctx.error === "SESSION_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: ctx.error }, { status });
  }
  if (!ctx.context.rubric.length) return NextResponse.json({ error: "NO_RUBRIC_FOR_SESSION" }, { status: 400 });

  const { provider, model } = describeAiProvider();

  // Signed URLs only for key-backed providers; mock never needs them.
  let imageUrls: string[] = [];
  if (provider !== "mock" && isR2Configured() && ctx.context.assetIds.length) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data: assets } = await admin.from("assets").select("id,storage_key")
        .eq("organization_id", ctx.context.organizationId).in("id", ctx.context.assetIds).is("deleted_at", null);
      imageUrls = await Promise.all((assets ?? []).map((a) => createDownloadUrl(String(a.storage_key)).catch(() => "")));
      imageUrls = imageUrls.filter(Boolean);
    }
  }

  const attemptCount = (await listOwnAiAssessments(auth.user!.id, ctx.context.classId)).filter((a) => a.classSessionId === body.classSessionId).length;

  const result = await analyzeSubmission({
    seed: `${body.classSessionId}|${auth.user!.id}|${attemptCount}`,
    rubric: ctx.context.rubric,
    note: ctx.context.note,
    imageCount: ctx.context.assetIds.length,
    imageUrls,
    sessionTitle: ctx.context.sessionTitle,
    sessionType: ctx.context.sessionType,
  });

  const saved = await saveClassAiAssessment({
    studentId: auth.user!.id,
    classSessionId: body.classSessionId,
    context: ctx.context,
    result,
    provider,
    model,
  });

  if (!saved) return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  return NextResponse.json({ assessment: saved, providerLive: describeAiProvider().live });
}
