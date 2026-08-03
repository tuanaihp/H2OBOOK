import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/learning-intelligence/service";

// Lists academy lessons an instructor can attach a new Knowledge Space to (§9 — a lesson may
// carry at most one Knowledge Space, enforced by the unique(content_item_id) constraint).
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const access = await resolveOrganizationAccess(auth.user!, organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data: courses } = await supabase.from("academy_courses").select("id,title").eq("organization_id", access.organizationId);
  const courseTitle = new Map((courses ?? []).map((course) => [String(course.id), String(course.title)]));
  const courseIds = (courses ?? []).map((course) => String(course.id));
  const { data: modules } = courseIds.length ? await supabase.from("academy_course_modules").select("id,title,course_id").in("course_id", courseIds) : { data: [] };
  const moduleInfo = new Map((modules ?? []).map((module) => [String(module.id), { title: String(module.title), courseTitle: courseTitle.get(String(module.course_id)) ?? "" }]));
  const moduleIds = (modules ?? []).map((module) => String(module.id));
  const { data: lessons } = moduleIds.length ? await supabase.from("academy_course_lessons").select("id,title,module_id").in("module_id", moduleIds).order("position", { ascending: true }) : { data: [] };
  const { data: spaces } = await supabase.from("knowledge_spaces").select("content_item_id").eq("organization_id", access.organizationId);
  const linked = new Set((spaces ?? []).map((space) => String(space.content_item_id)));

  const result = (lessons ?? []).map((lesson) => {
    const info = moduleInfo.get(String(lesson.module_id));
    return { id: String(lesson.id), title: String(lesson.title), moduleTitle: info?.title ?? "", courseTitle: info?.courseTitle ?? "", hasSpace: linked.has(String(lesson.id)) };
  });
  return NextResponse.json({ lessons: result, organizationId: access.organizationId });
}
