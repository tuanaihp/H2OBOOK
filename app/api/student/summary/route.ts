import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getAcademySkillProgress, getStudentCourseSummaries } from "@/lib/academy/student-course";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getSkillMastery } from "@/lib/student/mastery";
import { buildTodayPlanForUser } from "@/lib/student/planner";
import { getUnlockedStageIds } from "@/lib/student/stage-access";
import { loadCareerStages } from "@/lib/career-stages/service";

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
  //
  // `stages` (real career_stages, keyed by slug) rides alongside unlockedStageIds so the Smart
  // Home roadmap widget can render real stage titles instead of its own hardcoded fallback list —
  // unlockedStageIds is keyed by slug (lib/student/stage-access.ts) and has nothing to match
  // against without the real stage rows to go with it.
  const organizationId = auth.user!.demo ? undefined : await configuredAcademyOrganizationId();
  const [skillMastery, todayTasks, unlockedStageIds, stages] = organizationId
    ? await (async () => {
        const m = await getSkillMastery(auth.user!.id, organizationId);
        const [today, unlocked, careerStages] = await Promise.all([
          buildTodayPlanForUser(auth.user!.id, organizationId, m),
          getUnlockedStageIds(auth.user!.id, organizationId),
          loadCareerStages(organizationId)
        ]);
        return [m, today, unlocked, careerStages] as const;
      })()
    : [[], [], new Set<string>(), []];

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
    unlockedStageIds: [...unlockedStageIds],
    stages: [...stages].sort((a, b) => a.position - b.position).map((stage) => ({ slug: stage.slug, title: stage.title, description: stage.description || stage.subtitle })),
    mode: auth.user!.demo ? "demo" : "production"
  });
}
