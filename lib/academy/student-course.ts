import "server-only";

import type { CurrentUser } from "@/lib/auth/current-user";
import { buildCourseModules } from "@/lib/academy/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { ensureAcademyCatalogProduct, resolveAcademyOrganization } from "@/lib/academy/service";
import { findPublicCourse, publicCourses } from "@/lib/public-site/content";

export type StudentLesson = {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationSeconds: number;
  videoProvider: "cloudflare_stream" | "direct" | "embed" | "none";
  videoPlaybackId?: string;
  videoUrl?: string;
  skillKeys: string[];
  content: { summary?: string; checklist?: string[] };
  completed: boolean;
  watchSeconds: number;
  lastPositionSeconds: number;
};

export type StudentCourseModule = { id: string; slug: string; title: string; position: number; lessons: StudentLesson[] };

export type StudentCourseData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  level: string;
  accent: string;
  access: boolean;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  modules: StudentCourseModule[];
  mode: "demo" | "production";
};

export async function userCanAccessAcademyCourse(user: CurrentUser, organizationId: string, courseId: string) {
  if (user.demo) return true;
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { data: member } = await admin.from("organization_members").select("role,status").eq("organization_id", organizationId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (member && ["owner", "admin", "teacher"].includes(String(member.role))) return true;
  const { data: entitlements } = await admin.from("entitlements").select("resource_type,resource_id,expires_at,status").eq("organization_id", organizationId).eq("user_id", user.id).eq("status", "active");
  const now = Date.now();
  return (entitlements ?? []).some((item) => (!item.expires_at || new Date(String(item.expires_at)).getTime() > now) && (
    (item.resource_type === "course" && String(item.resource_id) === courseId) || item.resource_type === "membership"
  ));
}

function demoCourse(slug: string): StudentCourseData | null {
  const course = findPublicCourse(slug);
  if (!course) return null;
  const streamUid = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_DEMO_UID;
  const modules = buildCourseModules(slug).map((module, moduleIndex) => ({
    id: `demo-module-${module.slug}`,
    slug: module.slug,
    title: module.title,
    position: moduleIndex,
    lessons: module.lessons.map((lesson) => ({
      id: `demo-lesson-${lesson.slug}`,
      slug: lesson.slug,
      title: lesson.title,
      description: lesson.description,
      durationSeconds: lesson.durationSeconds,
      videoProvider: streamUid ? "cloudflare_stream" as const : "none" as const,
      videoPlaybackId: streamUid || undefined,
      skillKeys: lesson.skillKeys,
      content: { summary: lesson.description, checklist: ["Xem bài giảng", "Ghi lại điểm chính", "Hoàn thành phần thực hành"] },
      completed: false,
      watchSeconds: 0,
      lastPositionSeconds: 0
    }))
  }));
  return { id: `demo-course-${slug}`, slug, title: course.title, subtitle: course.subtitle, category: course.category, level: course.level, accent: course.accent, access: true, progressPercent: 0, completedLessons: 0, totalLessons: course.lessons, modules, mode: "demo" };
}

export async function getStudentCourse(user: CurrentUser, slug: string): Promise<StudentCourseData | null> {
  if (!isSupabaseConfigured()) return demoCourse(slug);
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const organization = await resolveAcademyOrganization(admin);
  if (!organization) return null;
  await ensureAcademyCatalogProduct(admin, String(organization.id), "course", slug);
  const { data: course } = await admin.from("academy_courses").select("id,slug,title,subtitle,category,level,accent,organization_id").eq("organization_id", organization.id).eq("slug", slug).eq("status", "active").maybeSingle();
  if (!course) return null;
  const access = await userCanAccessAcademyCourse(user, String(course.organization_id), String(course.id));
  if (!access) return { id: String(course.id), slug: String(course.slug), title: String(course.title), subtitle: String(course.subtitle), category: String(course.category), level: String(course.level), accent: String(course.accent), access: false, progressPercent: 0, completedLessons: 0, totalLessons: 0, modules: [], mode: "production" };

  const { data: moduleRows } = await admin.from("academy_course_modules").select("id,slug,title,position").eq("course_id", course.id).eq("status", "published").order("position", { ascending: true });
  const moduleIds = (moduleRows ?? []).map((item) => String(item.id));
  const { data: lessonRows } = moduleIds.length ? await admin.from("academy_course_lessons").select("id,module_id,slug,title,description,position,duration_seconds,video_provider,video_playback_id,video_url,skill_keys,content").in("module_id", moduleIds).eq("status", "published").order("position", { ascending: true }) : { data: [] };
  const lessonIds = (lessonRows ?? []).map((item) => String(item.id));
  const { data: progressRows } = lessonIds.length ? await admin.from("academy_lesson_progress").select("lesson_id,completed,watch_seconds,last_position_seconds").eq("user_id", user.id).in("lesson_id", lessonIds) : { data: [] };
  const progressMap = new Map((progressRows ?? []).map((item) => [String(item.lesson_id), item]));
  const modules: StudentCourseModule[] = (moduleRows ?? []).map((module) => ({
    id: String(module.id),
    slug: String(module.slug),
    title: String(module.title),
    position: Number(module.position),
    lessons: (lessonRows ?? []).filter((lesson) => lesson.module_id === module.id).map((lesson) => {
      const progress = progressMap.get(String(lesson.id));
      return {
        id: String(lesson.id),
        slug: String(lesson.slug),
        title: String(lesson.title),
        description: String(lesson.description ?? ""),
        durationSeconds: Number(lesson.duration_seconds ?? 0),
        videoProvider: String(lesson.video_provider ?? "none") as StudentLesson["videoProvider"],
        videoPlaybackId: lesson.video_playback_id ? String(lesson.video_playback_id) : undefined,
        videoUrl: lesson.video_url ? String(lesson.video_url) : undefined,
        skillKeys: Array.isArray(lesson.skill_keys) ? lesson.skill_keys.map(String) : [],
        content: (lesson.content ?? {}) as StudentLesson["content"],
        completed: Boolean(progress?.completed),
        watchSeconds: Number(progress?.watch_seconds ?? 0),
        lastPositionSeconds: Number(progress?.last_position_seconds ?? 0)
      };
    })
  }));
  const flatLessons = modules.flatMap((module) => module.lessons);
  const completedLessons = flatLessons.filter((lesson) => lesson.completed).length;
  return {
    id: String(course.id),
    slug: String(course.slug),
    title: String(course.title),
    subtitle: String(course.subtitle),
    category: String(course.category),
    level: String(course.level),
    accent: String(course.accent),
    access: true,
    progressPercent: flatLessons.length ? Math.round(completedLessons * 100 / flatLessons.length) : 0,
    completedLessons,
    totalLessons: flatLessons.length,
    modules,
    mode: "production"
  };
}

export async function getAcademySkillProgress(user: CurrentUser) {
  if (!isSupabaseConfigured() || user.demo) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("academy_skill_progress").select("skill_key,progress_percent,evidence_count").eq("user_id", user.id);
  const grouped = new Map<string, { total: number; count: number; evidence: number }>();
  for (const row of data ?? []) {
    const key = String(row.skill_key);
    const current = grouped.get(key) ?? { total: 0, count: 0, evidence: 0 };
    current.total += Number(row.progress_percent ?? 0);
    current.count += 1;
    current.evidence += Number(row.evidence_count ?? 0);
    grouped.set(key, current);
  }
  return new Map([...grouped].map(([key, value]) => [key, { progress: Math.round(value.total / Math.max(1, value.count)), evidenceCount: value.evidence }]));
}

export type StudentCourseSummary = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  accent: string;
  access: boolean;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
};

export async function getStudentCourseSummaries(user: CurrentUser): Promise<StudentCourseSummary[]> {
  if (!isSupabaseConfigured() || user.demo) return publicCourses.map((course) => ({ slug: course.slug, title: course.title, subtitle: course.subtitle, category: course.category, accent: course.accent, access: true, progressPercent: 0, completedLessons: 0, totalLessons: course.lessons }));
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const organization = await resolveAcademyOrganization(admin);
  if (!organization) return [];
  let { data: courseRows } = await admin.from("academy_courses").select("id,slug,title,subtitle,category,accent").eq("organization_id", organization.id).eq("status", "active");
  if (!courseRows?.length) {
    for (const course of publicCourses) await ensureAcademyCatalogProduct(admin, String(organization.id), "course", course.slug);
    const result = await admin.from("academy_courses").select("id,slug,title,subtitle,category,accent").eq("organization_id", organization.id).eq("status", "active");
    courseRows = result.data;
  }
  const courseIds = (courseRows ?? []).map((course) => String(course.id));
  const { data: member } = await admin.from("organization_members").select("role,status").eq("organization_id", organization.id).eq("user_id", user.id).eq("status", "active").maybeSingle();
  const privileged = Boolean(member && ["owner", "admin", "teacher"].includes(String(member.role)));
  const { data: entitlements } = await admin.from("entitlements").select("resource_type,resource_id,expires_at").eq("organization_id", organization.id).eq("user_id", user.id).eq("status", "active");
  const now = Date.now();
  const activeEntitlements = (entitlements ?? []).filter((item) => !item.expires_at || new Date(String(item.expires_at)).getTime() > now);
  const membershipAccess = activeEntitlements.some((item) => item.resource_type === "membership");
  const courseAccess = new Set(activeEntitlements.filter((item) => item.resource_type === "course").map((item) => String(item.resource_id)));
  const { data: modules } = courseIds.length ? await admin.from("academy_course_modules").select("id,course_id").in("course_id", courseIds).eq("status", "published") : { data: [] };
  const moduleIds = (modules ?? []).map((module) => String(module.id));
  const moduleCourse = new Map((modules ?? []).map((module) => [String(module.id), String(module.course_id)]));
  const { data: lessons } = moduleIds.length ? await admin.from("academy_course_lessons").select("id,module_id").in("module_id", moduleIds).eq("status", "published") : { data: [] };
  const lessonIds = (lessons ?? []).map((lesson) => String(lesson.id));
  const { data: progress } = lessonIds.length ? await admin.from("academy_lesson_progress").select("lesson_id,completed").eq("user_id", user.id).in("lesson_id", lessonIds) : { data: [] };
  const completed = new Set((progress ?? []).filter((item) => item.completed).map((item) => String(item.lesson_id)));
  const courseLessons = new Map<string, string[]>();
  for (const lesson of lessons ?? []) {
    const courseId = moduleCourse.get(String(lesson.module_id));
    if (courseId) courseLessons.set(courseId, [...(courseLessons.get(courseId) ?? []), String(lesson.id)]);
  }
  return (courseRows ?? []).map((course) => {
    const ids = courseLessons.get(String(course.id)) ?? [];
    const completedLessons = ids.filter((id) => completed.has(id)).length;
    return {
      slug: String(course.slug), title: String(course.title), subtitle: String(course.subtitle), category: String(course.category), accent: String(course.accent),
      access: privileged || membershipAccess || courseAccess.has(String(course.id)),
      progressPercent: ids.length ? Math.round(completedLessons * 100 / ids.length) : 0,
      completedLessons, totalLessons: ids.length
    };
  }).sort((a, b) => publicCourses.findIndex((item) => item.slug === a.slug) - publicCourses.findIndex((item) => item.slug === b.slug));
}
