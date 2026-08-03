import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import type { SkillMastery } from "@/lib/student/mastery";

// Today Task Planner (adapted from v5/11-h2obook-learn-mastery-engine-v1/src/core/planner.ts).
// Ranking logic is ported as pure functions; buildTodayPlanForUser() assembles LearningTask[]
// from real, currently-live tables only (see migration 0028's header for why no persisted
// h2o_learn_daily_tasks table was created) — every task here has a real deep link and a real
// source row behind it, never fabricated demo content.

export type TaskKind = "lesson" | "review" | "assignment" | "quiz" | "create" | "feedback";
export interface LearningTask { id: string; title: string; description: string; kind: TaskKind; href: string; estimatedMinutes: number; dueAt?: string; status: "not_started" | "in_progress"; priority: number; relatedSkillKeys: string[] }

function dueScore(dueAt?: string): number {
  if (!dueAt) return 0;
  const days = (new Date(dueAt).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 50;
  if (days <= 1) return 35;
  if (days <= 3) return 20;
  return 5;
}
const KIND_SCORE: Record<TaskKind, number> = { feedback: 40, assignment: 35, quiz: 25, review: 20, lesson: 15, create: 12 };

export function rankLearningTasks(tasks: LearningTask[], skills: SkillMastery[]): LearningTask[] {
  const skillMap = new Map(skills.map((skill) => [skill.key, skill.masteryPercent]));
  return [...tasks].sort((a, b) => {
    const weakness = (task: LearningTask) => task.relatedSkillKeys.reduce((sum, key) => sum + (100 - (skillMap.get(key) ?? 50)), 0) / Math.max(task.relatedSkillKeys.length, 1);
    const score = (task: LearningTask) => task.priority * 10 + dueScore(task.dueAt) + KIND_SCORE[task.kind] + weakness(task);
    return score(b) - score(a);
  });
}

export function buildTodayPlan(tasks: LearningTask[], skills: SkillMastery[], maxMinutes = 45): LearningTask[] {
  const ranked = rankLearningTasks(tasks, skills);
  const selected: LearningTask[] = [];
  let total = 0;
  for (const task of ranked) {
    if (selected.length > 0 && total + task.estimatedMinutes > maxMinutes) continue;
    selected.push(task);
    total += task.estimatedMinutes;
    if (total >= maxMinutes) break;
  }
  return selected;
}

export async function buildTodayPlanForUser(userId: string, organizationId: string, skills: SkillMastery[]): Promise<LearningTask[]> {
  if (!isSupabaseConfigured()) return [];
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const tasks: LearningTask[] = [];

  const { data: dueCards } = await admin.from("flashcards").select("id,front,next_review_at").eq("user_id", userId).eq("organization_id", organizationId).lte("next_review_at", new Date().toISOString()).order("next_review_at", { ascending: true }).limit(5);
  if (dueCards?.length) tasks.push({ id: `review-${dueCards[0].id}`, title: `Ôn ${dueCards.length} thẻ đến hạn`, description: String(dueCards[0].front ?? "").slice(0, 80), kind: "review", href: "/student/learn", estimatedMinutes: Math.min(15, dueCards.length * 2), dueAt: String(dueCards[0].next_review_at), status: "not_started", priority: 2, relatedSkillKeys: [] });

  const { data: draftProjects } = await admin.from("create_outcome_projects").select("id,title,readiness_score,skill_keys").eq("owner_user_id", userId).in("status", ["draft", "in_progress"]).order("updated_at", { ascending: false }).limit(3);
  for (const project of draftProjects ?? []) {
    tasks.push({ id: `create-${project.id}`, title: `Tiếp tục "${project.title}"`, description: `Đã hoàn thiện ${project.readiness_score}% — điền thêm để đạt mốc chia sẻ.`, kind: "create", href: `/student/create/projects/${project.id}`, estimatedMinutes: 15, status: "in_progress", priority: 1, relatedSkillKeys: Array.isArray(project.skill_keys) ? project.skill_keys.map(String) : [] });
  }

  return buildTodayPlan(tasks, skills);
}
