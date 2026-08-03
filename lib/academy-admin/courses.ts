import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/learning-intelligence/service";
import type { AcademyAdminAccess, CourseDetail, CourseStatus, CourseSummary, ModuleLessonStatus } from "./types";

export async function listCourses(access: AcademyAdminAccess): Promise<CourseSummary[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data: courses } = await supabase.from("academy_courses").select("id,slug,title,category,status,updated_at").eq("organization_id", access.organizationId).order("updated_at", { ascending: false });
  if (!courses?.length) return [];

  const courseIds = courses.map((c) => String(c.id));
  const { data: modules } = await supabase.from("academy_course_modules").select("id,course_id").in("course_id", courseIds);
  const moduleIds = (modules ?? []).map((m) => String(m.id));
  const moduleCountByCourse = new Map<string, number>();
  for (const m of modules ?? []) moduleCountByCourse.set(String(m.course_id), (moduleCountByCourse.get(String(m.course_id)) ?? 0) + 1);

  const { data: lessons } = moduleIds.length ? await supabase.from("academy_course_lessons").select("id,module_id,status").in("module_id", moduleIds) : { data: [] as { id: string; module_id: string; status: string }[] };
  const moduleToCourse = new Map((modules ?? []).map((m) => [String(m.id), String(m.course_id)]));
  const lessonCountByCourse = new Map<string, number>();
  const publishedByCourse = new Map<string, number>();
  for (const lesson of lessons ?? []) {
    const courseId = moduleToCourse.get(String(lesson.module_id));
    if (!courseId) continue;
    lessonCountByCourse.set(courseId, (lessonCountByCourse.get(courseId) ?? 0) + 1);
    if (lesson.status === "published") publishedByCourse.set(courseId, (publishedByCourse.get(courseId) ?? 0) + 1);
  }

  return courses.map((course) => ({
    id: String(course.id),
    slug: String(course.slug),
    title: String(course.title),
    category: String(course.category),
    status: course.status as CourseStatus,
    moduleCount: moduleCountByCourse.get(String(course.id)) ?? 0,
    lessonCount: lessonCountByCourse.get(String(course.id)) ?? 0,
    publishedLessonCount: publishedByCourse.get(String(course.id)) ?? 0,
    updatedAt: String(course.updated_at)
  }));
}

export async function getCourseDetail(access: AcademyAdminAccess, courseId: string): Promise<CourseDetail | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: course } = await supabase.from("academy_courses").select("*").eq("id", courseId).eq("organization_id", access.organizationId).maybeSingle();
  if (!course) return null;

  const { data: modules } = await supabase.from("academy_course_modules").select("id,slug,title,description,position,status").eq("course_id", courseId).order("position", { ascending: true });
  const moduleIds = (modules ?? []).map((m) => String(m.id));
  const { data: lessons } = moduleIds.length ? await supabase.from("academy_course_lessons").select("id,module_id,slug,title,description,position,duration_seconds,video_url,status,is_preview,skill_keys").in("module_id", moduleIds).order("position", { ascending: true }) : { data: [] as Record<string, unknown>[] };

  const lessonsByModule = new Map<string, CourseDetail["modules"][number]["lessons"]>();
  for (const lesson of lessons ?? []) {
    const moduleId = String(lesson.module_id);
    const list = lessonsByModule.get(moduleId) ?? [];
    list.push({
      id: String(lesson.id), slug: String(lesson.slug), title: String(lesson.title), description: String(lesson.description ?? ""),
      position: Number(lesson.position ?? 0), durationSeconds: Number(lesson.duration_seconds ?? 0),
      videoUrl: lesson.video_url ? String(lesson.video_url) : null, status: lesson.status as ModuleLessonStatus,
      isPreview: Boolean(lesson.is_preview), skillKeys: (lesson.skill_keys as string[]) ?? []
    });
    lessonsByModule.set(moduleId, list);
  }

  return {
    id: String(course.id), slug: String(course.slug), title: String(course.title), subtitle: String(course.subtitle ?? ""),
    description: String(course.description ?? ""), category: String(course.category ?? ""), level: String(course.level ?? ""),
    status: course.status as CourseStatus, price: Number(course.price ?? 0), currency: String(course.currency ?? "VND"),
    modules: (modules ?? []).map((module) => ({
      id: String(module.id), slug: String(module.slug), title: String(module.title), description: String(module.description ?? ""),
      position: Number(module.position ?? 0), status: module.status as ModuleLessonStatus,
      lessons: (lessonsByModule.get(String(module.id)) ?? []).sort((a, b) => a.position - b.position)
    }))
  };
}

export interface CreateCourseInput { title: string; category?: string; level?: string; description?: string }

export async function createCourse(access: AcademyAdminAccess, input: CreateCourseInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const slug = slugify(input.title);
  const { data, error } = await supabase.from("academy_courses").insert({
    organization_id: access.organizationId, slug, title: input.title, category: input.category ?? "", level: input.level ?? "", description: input.description ?? "", status: "draft"
  }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "COURSE_CREATE_FAILED" };
  return { ok: true as const, id: String(data.id) };
}

export interface UpdateCourseInput { title?: string; subtitle?: string; description?: string; category?: string; level?: string; status?: CourseStatus; price?: number }

export async function updateCourse(access: AcademyAdminAccess, courseId: string, input: UpdateCourseInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const patch: Record<string, unknown> = { ...input };
  if (input.status === "active" && input.status !== undefined) patch.published_at = new Date().toISOString();
  const { error } = await supabase.from("academy_courses").update(patch).eq("id", courseId).eq("organization_id", access.organizationId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function createModule(access: AcademyAdminAccess, courseId: string, title: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { data: existing } = await supabase.from("academy_course_modules").select("position").eq("course_id", courseId).order("position", { ascending: false }).limit(1).maybeSingle();
  const position = (existing?.position ?? -1) + 1;
  const { data, error } = await supabase.from("academy_course_modules").insert({ course_id: courseId, slug: slugify(title), title, position, status: "draft" }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "MODULE_CREATE_FAILED" };
  return { ok: true as const, id: String(data.id) };
}

export interface UpdateModuleInput { title?: string; description?: string; status?: ModuleLessonStatus; position?: number }

export async function updateModule(moduleId: string, input: UpdateModuleInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("academy_course_modules").update(input).eq("id", moduleId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function createLesson(moduleId: string, title: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { data: existing } = await supabase.from("academy_course_lessons").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1).maybeSingle();
  const position = (existing?.position ?? -1) + 1;
  const { data, error } = await supabase.from("academy_course_lessons").insert({ module_id: moduleId, slug: slugify(title), title, position, status: "draft" }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "LESSON_CREATE_FAILED" };
  return { ok: true as const, id: String(data.id) };
}

export interface UpdateLessonInput { title?: string; description?: string; videoUrl?: string; durationSeconds?: number; status?: ModuleLessonStatus; isPreview?: boolean; skillKeys?: string[] }

export async function updateLesson(lessonId: string, input: UpdateLessonInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.videoUrl !== undefined) patch.video_url = input.videoUrl;
  if (input.durationSeconds !== undefined) patch.duration_seconds = input.durationSeconds;
  if (input.status !== undefined) patch.status = input.status;
  if (input.isPreview !== undefined) patch.is_preview = input.isPreview;
  if (input.skillKeys !== undefined) patch.skill_keys = input.skillKeys;
  const { error } = await supabase.from("academy_course_lessons").update(patch).eq("id", lessonId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
