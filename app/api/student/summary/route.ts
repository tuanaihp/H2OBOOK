import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getAcademySkillProgress, getStudentCourseSummaries } from "@/lib/academy/student-course";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getSkillMastery } from "@/lib/student/mastery";
import { buildTodayPlanForUser } from "@/lib/student/planner";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const [courses, skills] = await Promise.all([getStudentCourseSummaries(auth.user!), getAcademySkillProgress(auth.user!)]);
  const activeCourses = courses.filter((course) => course.access);
  const courseProgress = activeCourses.length ? Math.round(activeCourses.reduce((sum, course) => sum + course.progressPercent, 0) / activeCourses.length) : 0;
  const skillValues = skills ? [...skills.values()] : [];
  const mastery = skillValues.length ? Math.round(skillValues.reduce((sum, item) => sum + item.progress, 0) / skillValues.length) : courseProgress;
  const nextCourse = activeCourses.find((course) => course.progressPercent < 100) ?? activeCourses[0] ?? null;

  // Learn Mastery Engine V1: real skill mastery + a real, deep-linked Today Plan — both empty
  // arrays (not fabricated) when Supabase/organization aren't configured, e.g. demo mode.
  const organizationId = auth.user!.demo ? undefined : await configuredAcademyOrganizationId();
  const [skillMastery, todayTasks] = organizationId
    ? await (async () => { const m = await getSkillMastery(auth.user!.id, organizationId); return [m, await buildTodayPlanForUser(auth.user!.id, organizationId, m)] as const; })()
    : [[], []];

  return NextResponse.json({
    user: { name: auth.user!.name, email: auth.user!.email },
    courseProgress,
    mastery,
    activeCourses: activeCourses.length,
    completedLessons: activeCourses.reduce((sum, course) => sum + course.completedLessons, 0),
    totalLessons: activeCourses.reduce((sum, course) => sum + course.totalLessons, 0),
    nextCourse: nextCourse ? { slug: nextCourse.slug, title: nextCourse.title } : null,
    skillMastery,
    todayTasks,
    mode: auth.user!.demo ? "demo" : "production"
  });
}
