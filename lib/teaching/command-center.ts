import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAssignedStudentSummaries } from "./students";
import { rankTeachingTasks } from "./tasks";
import type { RankedTeachingTask, TeachingAccessSnapshot, TeachingTask } from "./types";

export interface TeachingCommandCenterSummary {
  classCount: number;
  studentCount: number;
  pendingSubmissionCount: number;
  atRiskCount: number;
  pendingPortfolioReviewCount: number;
  tasks: RankedTeachingTask[];
  recentAchievements: { id: string; title: string; studentName: string; updatedAt: string }[];
}

// Deterministic aggregation, no AI involved (H2OBOOK Teaching Intelligence Center V1 §C: "Ranking
// must be deterministic and work without AI"). Content-review and class-session task kinds from
// the source module are intentionally absent — see lib/teaching/tasks.ts header comment.
export async function buildTeachingCommandCenter(access: TeachingAccessSnapshot): Promise<TeachingCommandCenterSummary> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { classCount: 0, studentCount: 0, pendingSubmissionCount: 0, atRiskCount: 0, pendingPortfolioReviewCount: 0, tasks: [], recentAchievements: [] };
  }

  const [students, classIdsResult] = await Promise.all([
    getAssignedStudentSummaries(access),
    access.canViewAllClasses
      ? admin.from("classes").select("id").eq("organization_id", access.organizationId)
      : Promise.resolve({ data: access.assignedClassIds.map((id) => ({ id })) })
  ]);
  const classIds = (classIdsResult.data ?? []).map((row) => String(row.id));
  const studentIds = students.map((s) => s.studentId);
  const profileByStudent = new Map(students.map((s) => [s.studentId, s.name]));

  const tasks: TeachingTask[] = [];
  let recentAchievements: { id: string; title: string; studentName: string; updatedAt: string }[] = [];

  if (classIds.length) {
    const { data: legacyRows } = await admin
      .from("assignment_submissions")
      .select("id,student_id,status,submitted_at,assignments!inner(class_id,due_at,title)")
      .in("assignments.class_id", classIds)
      .eq("status", "submitted");
    for (const row of (legacyRows ?? []) as { id: string; student_id: string; submitted_at: string | null; assignments: { title: string; due_at: string | null } | { title: string; due_at: string | null }[] }[]) {
      const assignment = Array.isArray(row.assignments) ? row.assignments[0] : row.assignments;
      const waitingHours = row.submitted_at ? (Date.now() - new Date(row.submitted_at).getTime()) / 3_600_000 : undefined;
      tasks.push({
        id: `legacy-${row.id}`,
        kind: "grade_submission",
        title: `Chấm bài: ${assignment?.title ?? "Bài tập"} — ${profileByStudent.get(String(row.student_id)) ?? "Học viên"}`,
        dueAt: assignment?.due_at ?? undefined,
        waitingHours,
        studentId: String(row.student_id),
        sourceId: String(row.id)
      });
    }
  }

  if (studentIds.length) {
    const { data: brainRows } = await admin
      .from("brain_assignment_submissions")
      .select("id,user_id,submitted_at,assignment_definitions(title)")
      .eq("organization_id", access.organizationId)
      .in("user_id", studentIds)
      .eq("status", "submitted");
    for (const row of (brainRows ?? []) as { id: string; user_id: string; submitted_at: string | null; assignment_definitions: { title: string } | { title: string }[] | null }[]) {
      const def = Array.isArray(row.assignment_definitions) ? row.assignment_definitions[0] : row.assignment_definitions;
      const waitingHours = row.submitted_at ? (Date.now() - new Date(row.submitted_at).getTime()) / 3_600_000 : undefined;
      tasks.push({
        id: `brain-${row.id}`,
        kind: "grade_submission",
        title: `Chấm bài Brain Studio: ${def?.title ?? "Bài tập"} — ${profileByStudent.get(String(row.user_id)) ?? "Học viên"}`,
        waitingHours,
        studentId: String(row.user_id),
        sourceId: String(row.id)
      });
    }

    const { data: projectRows } = await admin
      .from("create_outcome_projects")
      .select("id,title,owner_user_id,updated_at,status")
      .eq("organization_id", access.organizationId)
      .in("owner_user_id", studentIds)
      .eq("status", "needs_review");
    for (const row of projectRows ?? []) {
      tasks.push({
        id: `portfolio-${row.id}`,
        kind: "approve_portfolio",
        title: `Duyệt thành quả: ${row.title} — ${profileByStudent.get(String(row.owner_user_id)) ?? "Học viên"}`,
        studentId: String(row.owner_user_id),
        sourceId: String(row.id)
      });
    }

    const { data: achievementRows } = await admin
      .from("create_outcome_projects")
      .select("id,title,owner_user_id,updated_at")
      .eq("organization_id", access.organizationId)
      .in("owner_user_id", studentIds)
      .in("status", ["approved", "published"])
      .order("updated_at", { ascending: false })
      .limit(6);
    recentAchievements = (achievementRows ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      studentName: profileByStudent.get(String(row.owner_user_id)) ?? "Học viên",
      updatedAt: String(row.updated_at)
    }));
  }

  for (const student of students) {
    if (student.risk.severity === "attention" || student.risk.severity === "critical") {
      tasks.push({
        id: `risk-${student.studentId}`,
        kind: "student_intervention",
        title: `Học viên cần hỗ trợ: ${student.name}`,
        riskSeverity: student.risk.severity,
        studentId: student.studentId
      });
    }
  }

  return {
    classCount: classIds.length,
    studentCount: studentIds.length,
    pendingSubmissionCount: tasks.filter((t) => t.kind === "grade_submission").length,
    atRiskCount: students.filter((s) => s.risk.severity === "attention" || s.risk.severity === "critical").length,
    pendingPortfolioReviewCount: tasks.filter((t) => t.kind === "approve_portfolio").length,
    tasks: rankTeachingTasks(tasks),
    recentAchievements
  };
}
