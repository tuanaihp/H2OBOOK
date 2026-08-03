import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const knowledgeSpaceId = new URL(request.url).searchParams.get("knowledgeSpaceId");
  if (!knowledgeSpaceId) return NextResponse.json({ error: "KNOWLEDGE_SPACE_ID_REQUIRED" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase.from("learner_notes").select("*").eq("user_id", auth.user!.id).eq("knowledge_space_id", knowledgeSpaceId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { knowledgeSpaceId?: string; organizationId?: string; blockId?: string; lessonTimestampSeconds?: number; title?: string; body?: string; tags?: string[] } | null;
  if (!body?.knowledgeSpaceId || !body?.organizationId || !body?.body?.trim()) return NextResponse.json({ error: "NOTE_FIELDS_REQUIRED" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase.from("learner_notes").insert({
    organization_id: body.organizationId, user_id: auth.user!.id, knowledge_space_id: body.knowledgeSpaceId, block_id: body.blockId ?? null,
    lesson_timestamp_seconds: body.lessonTimestampSeconds ?? null, title: body.title ?? "", body: body.body.trim(), tags: body.tags ?? []
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, note: data }, { status: 201 });
}
