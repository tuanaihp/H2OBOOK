import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getRecipe } from "@/lib/student/create-outcome";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase
    .from("create_outcome_projects")
    .select("id,title,outcome_type,recipe_slug,status,progress_percent,readiness_score,updated_at")
    .eq("owner_user_id", auth.user!.id)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ projects: data ?? [] });
}

// recipe/source IDs are validated server-side; nothing about ownership or workspace comes from
// the client beyond the recipe slug and optional lesson/space context to link provenance to.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { recipeSlug?: string; title?: string; sourceLessonId?: string; sourceKnowledgeSpaceId?: string; sourceStageKey?: string } | null;
  const recipe = body?.recipeSlug ? getRecipe(body.recipeSlug) : undefined;
  if (!recipe) return NextResponse.json({ error: "RECIPE_NOT_FOUND" }, { status: 400 });
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ACADEMY_ORGANIZATION_NOT_CONFIGURED" }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  // The user-scoped client's RLS already restricts these reads to lessons/spaces this learner
  // is actually entitled to see, so a lookup miss here means "not theirs" — never trust the
  // client-supplied IDs directly, per the module's own provenance-validation rule.
  let sourceLessonId: string | null = null;
  if (body?.sourceLessonId) {
    const { data: lesson } = await supabase.from("academy_course_lessons").select("id").eq("id", body.sourceLessonId).maybeSingle();
    sourceLessonId = lesson?.id ? String(lesson.id) : null;
  }
  let sourceKnowledgeSpaceId: string | null = null;
  if (body?.sourceKnowledgeSpaceId) {
    const { data: space } = await supabase.from("knowledge_spaces").select("id").eq("id", body.sourceKnowledgeSpaceId).maybeSingle();
    sourceKnowledgeSpaceId = space?.id ? String(space.id) : null;
  }

  const { data, error } = await supabase.from("create_outcome_projects").insert({
    organization_id: organizationId,
    owner_user_id: auth.user!.id,
    title: body?.title?.trim() || recipe.title,
    outcome_type: recipe.outcomeType,
    recipe_slug: recipe.slug,
    editor_mode: recipe.editorMode,
    source_lesson_id: sourceLessonId,
    source_knowledge_space_id: sourceKnowledgeSpaceId,
    source_stage_key: body?.sourceStageKey || recipe.requiredStageKey || null,
    skill_keys: recipe.skillKeys,
    status: "draft",
    content: {}
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "PROJECT_CREATE_FAILED" }, { status: 400 });
  return NextResponse.json({ ok: true, projectId: data.id }, { status: 201 });
}
