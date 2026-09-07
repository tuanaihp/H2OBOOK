import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { listClassSessions } from "@/lib/student-competency/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ScheduleBody = { startDate?: string; endDate?: string; weekDays?: number[] };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const asDate = (value: string) => new Date(`${value}T00:00:00`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Distributes unfinished sessions across selected weekdays. Completed sessions are never moved. */
export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  const body = await request.json().catch(() => null) as ScheduleBody | null;
  // Saturday/Sunday are academy-wide default rest days and cannot be scheduled by this bulk tool.
  const weekDays = [...new Set((body?.weekDays ?? []).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5))].sort((a, b) => a - b);
  if (!body?.startDate || !body.endDate || !DATE.test(body.startDate) || !DATE.test(body.endDate) || !weekDays.length) return NextResponse.json({ error: "INVALID_SCHEDULE_PLAN" }, { status: 400 });
  const start = asDate(body.startDate); const end = asDate(body.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return NextResponse.json({ error: "INVALID_SCHEDULE_RANGE" }, { status: 400 });
  const sessions = await listClassSessions(access!, classId);
  if (sessions === null) return NextResponse.json({ error: "FORBIDDEN_CLASS_SCOPE" }, { status: 403 });
  const pending = sessions.filter((session) => session.status === "scheduled").sort((a, b) => a.sessionNo - b.sessionNo);
  if (!pending.length) return NextResponse.json({ ok: true, scheduled: 0, startDate: null, endDate: null, preservedCompleted: sessions.length });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data: blackoutRows, error: blackoutError } = await supabase.from("academy_calendar_blackouts").select("blackout_date").eq("organization_id", access!.organizationId);
  // During a staged rollout the application can be deployed before migration 0066 is applied.
  // Weekend exclusion remains safe; named holidays start taking effect as soon as the migration exists.
  if (blackoutError && blackoutError.code !== "42P01" && !/academy_calendar_blackouts/i.test(blackoutError.message ?? "")) return NextResponse.json({ error: "BLACKOUTS_LOAD_FAILED" }, { status: 400 });
  const blackouts = new Set((blackoutRows ?? []).map((row) => String(row.blackout_date)));
  const dates: string[] = [];
  for (let cursor = new Date(start); cursor <= end && dates.length < pending.length; cursor.setDate(cursor.getDate() + 1)) if (weekDays.includes(cursor.getDay()) && !blackouts.has(iso(cursor))) dates.push(iso(cursor));
  if (dates.length < pending.length) return NextResponse.json({ error: "SCHEDULE_RANGE_TOO_SHORT", required: pending.length, available: dates.length }, { status: 400 });
  const { data: updatedCount, error: bulkError } = await supabase.rpc("bulk_schedule_class_sessions", {
    p_class_id: classId,
    p_session_ids: pending.map((session) => session.id),
    p_session_dates: dates
  });
  // Safe staged rollout: deployments made before migration 0067 retain the old behaviour. As soon
  // as the migration exists, a 60-session schedule becomes one atomic database round trip.
  if (bulkError && (bulkError.code === "PGRST202" || bulkError.code === "42883" || /bulk_schedule_class_sessions/i.test(bulkError.message ?? ""))) {
    const updates = await Promise.all(pending.map((session, index) => supabase.from("class_sessions").update({ session_date: dates[index], updated_at: new Date().toISOString() }).eq("id", session.id).eq("class_id", classId).eq("status", "scheduled")));
    if (updates.some((result) => result.error)) return NextResponse.json({ error: "SCHEDULE_UPDATE_FAILED" }, { status: 400 });
  } else if (bulkError || Number(updatedCount) !== pending.length) return NextResponse.json({ error: "SCHEDULE_UPDATE_FAILED" }, { status: 400 });
  return NextResponse.json({ ok: true, scheduled: pending.length, startDate: dates[0], endDate: dates[dates.length - 1], preservedCompleted: sessions.length - pending.length });
}
