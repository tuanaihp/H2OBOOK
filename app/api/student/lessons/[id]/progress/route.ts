import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { userCanAccessAcademyCourse } from "@/lib/academy/student-course";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { completed?: boolean; watchSeconds?: number; lastPositionSeconds?: number } | null;
  if (typeof body?.completed !== "boolean") return NextResponse.json({ error: "COMPLETION_STATE_REQUIRED" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, lessonId: id, completed: body.completed, mode: "demo" });
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return NextResponse.json({ error: "VALID_LESSON_ID_REQUIRED" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const { data: lesson } = await admin.from("academy_course_lessons").select("id,duration_seconds,academy_course_modules!inner(course_id,academy_courses!inner(id,organization_id))").eq("id", id).eq("status", "published").maybeSingle();
  if (!lesson) return NextResponse.json({ error: "LESSON_NOT_FOUND" }, { status: 404 });
  const moduleValue = lesson.academy_course_modules as unknown as { course_id: string; academy_courses: { id: string; organization_id: string } | { id: string; organization_id: string }[] };
  const courseValue = Array.isArray(moduleValue.academy_courses) ? moduleValue.academy_courses[0] : moduleValue.academy_courses;
  if (!courseValue || !await userCanAccessAcademyCourse(auth.user!, String(courseValue.organization_id), String(courseValue.id))) return NextResponse.json({ error: "COURSE_ACCESS_REQUIRED" }, { status: 403 });
  const durationSeconds = Number(lesson.duration_seconds ?? 0);
  const maxSeconds = durationSeconds > 0 ? durationSeconds * 2 : 86_400;
  const requestedWatchSeconds = Number(body.watchSeconds ?? 0);
  const requestedPositionSeconds = Number(body.lastPositionSeconds ?? 0);
  const watchSeconds = Math.max(0, Math.min(maxSeconds, Math.floor(Number.isFinite(requestedWatchSeconds) ? requestedWatchSeconds : 0)));
  const lastPositionSeconds = Math.max(0, Math.min(durationSeconds > 0 ? durationSeconds : 86_400, Math.floor(Number.isFinite(requestedPositionSeconds) ? requestedPositionSeconds : 0)));
  const now = new Date().toISOString();
  const { data, error } = await admin.from("academy_lesson_progress").upsert({
    organization_id: courseValue.organization_id,
    user_id: auth.user!.id,
    lesson_id: id,
    completed: body.completed,
    watch_seconds: watchSeconds,
    last_position_seconds: lastPositionSeconds,
    last_watched_at: now,
    completed_at: body.completed ? now : null,
    updated_at: now
  }, { onConflict: "user_id,lesson_id" }).select("lesson_id,completed,watch_seconds,last_position_seconds,completed_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, progress: data, mode: "production" });
}
