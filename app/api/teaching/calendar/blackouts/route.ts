import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type BlackoutInput = { date?: string; label?: string };

export async function GET(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase.from("academy_calendar_blackouts").select("id,blackout_date,label").eq("organization_id", access!.organizationId).order("blackout_date");
  if (error) return NextResponse.json({ error: "BLACKOUTS_LOAD_FAILED" }, { status: 400 });
  return NextResponse.json({ blackouts: data ?? [] });
}

export async function POST(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  if (access!.role !== "owner" && access!.role !== "admin") return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  const body = await request.json().catch(() => null) as (BlackoutInput & { dates?: BlackoutInput[] }) | null;
  const inputs: BlackoutInput[] = Array.isArray(body?.dates) ? body.dates : body ? [body] : [];
  if (!inputs.length || inputs.length > 40 || inputs.some((item) => !item?.date || !DATE.test(item.date))) return NextResponse.json({ error: "INVALID_BLACKOUT_DATE" }, { status: 400 });
  const unique = [...new Map(inputs.map((item) => [item.date!, { date: item.date!, label: item.label?.trim().slice(0, 120) ?? "" }])).values()];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase.from("academy_calendar_blackouts").upsert(unique.map((item) => ({ organization_id: access!.organizationId, blackout_date: item.date, label: item.label, created_by: access!.userId })), { onConflict: "organization_id,blackout_date" }).select("id,blackout_date,label");
  if (error) return NextResponse.json({ error: "BLACKOUT_SAVE_FAILED" }, { status: 400 });
  return NextResponse.json({ blackout: data?.[0] ?? null, blackouts: data ?? [], count: data?.length ?? 0 }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  if (access!.role !== "owner" && access!.role !== "admin") return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "BLACKOUT_ID_REQUIRED" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { error } = await supabase.from("academy_calendar_blackouts").delete().eq("id", id).eq("organization_id", access!.organizationId);
  if (error) return NextResponse.json({ error: "BLACKOUT_DELETE_FAILED" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
