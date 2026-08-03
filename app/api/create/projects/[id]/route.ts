import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateReadinessScore, getRecipe } from "@/lib/student/create-outcome";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase.from("create_outcome_projects").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ project: data });
}

// RLS ("outcome projects owner all") already restricts writes to owner_user_id=auth.uid(), so a
// student can never edit another learner's project regardless of what id is in the URL.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { title?: string; content?: Record<string, string>; status?: string } | null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data: existing } = await supabase.from("create_outcome_projects").select("recipe_slug,content").eq("id", id).eq("owner_user_id", auth.user!.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  const recipe = getRecipe(String(existing.recipe_slug));
  const nextContent = { ...(existing.content as Record<string, string> ?? {}), ...(body?.content ?? {}) };
  const readiness = recipe ? calculateReadinessScore(recipe.sections, nextContent) : 0;
  const filledCount = recipe ? recipe.sections.filter((section) => nextContent[section.key]?.trim()).length : 0;
  const progress = recipe?.sections.length ? Math.round((filledCount * 100) / recipe.sections.length) : 0;

  const patch: Record<string, unknown> = { content: nextContent, readiness_score: readiness, progress_percent: progress };
  if (body?.title !== undefined) patch.title = body.title;
  if (body?.status && ["draft", "in_progress", "needs_review", "ready_to_export"].includes(body.status)) patch.status = body.status;
  else if (progress > 0) patch.status = readiness >= 100 ? "ready_to_export" : "in_progress";

  const { data, error } = await supabase.from("create_outcome_projects").update(patch).eq("id", id).eq("owner_user_id", auth.user!.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, project: data });
}
