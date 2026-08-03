// Pure deterministic task ranking — ported from
// v5/12-h2obook-teaching-intelligence-center-v1/src/core/tasks.ts. class_session/content_review/
// reply_question kinds from the source module are dropped: this repo has no session-schedule or
// content-review-assignment table yet (see integration report §Risks/TODO), so only the three
// kinds this module actually produces real data for are kept.
import type { RankedTeachingTask, RiskSeverity, TeachingTask, TeachingTaskKind } from "./types";

const BASE_SCORE: Record<TeachingTaskKind, number> = {
  grade_submission: 35,
  student_intervention: 45,
  approve_portfolio: 28
};

const RISK_BONUS: Record<RiskSeverity, number> = {
  healthy: 0,
  watch: 8,
  attention: 18,
  critical: 32
};

function hoursUntil(date: string, now: Date): number {
  return (new Date(date).getTime() - now.getTime()) / 3_600_000;
}

export function rankTeachingTask(task: TeachingTask, now = new Date()): RankedTeachingTask {
  let score = BASE_SCORE[task.kind];

  if (task.waitingHours !== undefined) {
    score += Math.min(30, Math.max(0, task.waitingHours - 12) / 2);
  }

  if (task.riskSeverity) score += RISK_BONUS[task.riskSeverity];

  if (task.dueAt) {
    const remaining = hoursUntil(task.dueAt, now);
    if (remaining <= 0) score += 30;
    else if (remaining <= 12) score += 22;
    else if (remaining <= 24) score += 14;
    else if (remaining <= 72) score += 6;
  }

  const priorityScore = Math.round(Math.min(100, score));
  const priorityLabel =
    priorityScore >= 80
      ? "urgent"
      : priorityScore >= 60
        ? "high"
        : priorityScore >= 35
          ? "normal"
          : "low";

  return { ...task, priorityScore, priorityLabel };
}

export function rankTeachingTasks(tasks: readonly TeachingTask[], now = new Date()): RankedTeachingTask[] {
  return tasks.map((task) => rankTeachingTask(task, now)).sort((a, b) => b.priorityScore - a.priorityScore);
}
