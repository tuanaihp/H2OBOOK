import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AcademyAdminAccess } from "./types";

export interface AcademyDashboardSummary {
  totalCourses: number;
  activeCourses: number;
  totalLessons: number;
  publishedLessons: number;
  pendingApplications: number;
  activeStudents: number;
  // Career stages are what an admin actually spends the day configuring, but this summary used to
  // report only video-course numbers — so the landing page said nothing about the thing it should
  // send people to first.
  totalStages: number;
  publishedStages: number;
  stageResources: number;
}

// Every number here is a real count query — no fabricated/demo metrics
// (CLAUDE_MAIN_INTEGRATION_PROMPT.md rule 11: "Do not use demo metrics in production").
export async function getAcademyDashboardSummary(access: AcademyAdminAccess): Promise<AcademyDashboardSummary> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { totalCourses: 0, activeCourses: 0, totalLessons: 0, publishedLessons: 0, pendingApplications: 0, activeStudents: 0, totalStages: 0, publishedStages: 0, stageResources: 0 };

  const [coursesRes, activeCoursesRes, applicationsRes, studentsRes, stagesRes, publishedStagesRes, stageResourcesRes] = await Promise.all([
    supabase.from("academy_courses").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId),
    supabase.from("academy_courses").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId).eq("status", "active"),
    supabase.from("academy_applications").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId).eq("status", "new"),
    supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId).eq("role", "student").eq("status", "active"),
    supabase.from("career_stages").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId).neq("status", "archived"),
    supabase.from("career_stages").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId).eq("status", "active"),
    supabase.from("career_stage_resources").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId).neq("status", "archived")
  ]);

  const { data: courseIdRows } = await supabase.from("academy_courses").select("id").eq("organization_id", access.organizationId);
  const courseIds = (courseIdRows ?? []).map((row) => String(row.id));
  const { data: moduleIdRows } = courseIds.length ? await supabase.from("academy_course_modules").select("id").in("course_id", courseIds) : { data: [] as { id: string }[] };
  const moduleIds = (moduleIdRows ?? []).map((row) => String(row.id));
  const [lessonsRes, publishedLessonsRes] = moduleIds.length
    ? await Promise.all([
        supabase.from("academy_course_lessons").select("id", { count: "exact", head: true }).in("module_id", moduleIds),
        supabase.from("academy_course_lessons").select("id", { count: "exact", head: true }).in("module_id", moduleIds).eq("status", "published")
      ])
    : [{ count: 0 }, { count: 0 }];

  return {
    totalCourses: coursesRes.count ?? 0,
    activeCourses: activeCoursesRes.count ?? 0,
    totalLessons: lessonsRes.count ?? 0,
    publishedLessons: publishedLessonsRes.count ?? 0,
    pendingApplications: applicationsRes.count ?? 0,
    activeStudents: studentsRes.count ?? 0,
    totalStages: stagesRes.count ?? 0,
    publishedStages: publishedStagesRes.count ?? 0,
    stageResources: stageResourcesRes.count ?? 0
  };
}
