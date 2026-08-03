import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSkillMastery, calculateOverallMastery } from "@/lib/student/mastery";
import { assessStudentRisk } from "./risk";
import { canAccessStudent } from "./access";
import type { StudentRiskAssessment, TeachingAccessSnapshot } from "./types";

export interface StudentSuccessSummary {
  studentId: string;
  name: string;
  avatarUrl: string | null;
  classIds: string[];
  progressPercent: number;
  masteryPercent: number;
  lastActivityAt: string | null;
  overdueAssignments: number;
  risk: StudentRiskAssessment;
}

export interface StudentInterventionRow {
  id: string;
  studentUserId: string;
  teacherUserId: string;
  classId: string | null;
  riskLevel: string;
  reasonCodes: string[];
  actionType: string;
  note: string | null;
  status: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

async function computeSignals(admin: ReturnType<typeof createSupabaseAdminClient>, organizationId: string, studentId: string) {
  const [lessonProgress, spaceProgress, skills, legacySubs, brainSubs] = await Promise.all([
    admin!.from("academy_lesson_progress").select("last_watched_at").eq("organization_id", organizationId).eq("user_id", studentId).order("last_watched_at", { ascending: false }).limit(1).maybeSingle(),
    admin!.from("knowledge_space_progress").select("percent").eq("organization_id", organizationId).eq("user_id", studentId),
    getSkillMastery(studentId, organizationId),
    admin!.from("assignment_submissions").select("status,submitted_at,assignments!inner(due_at,organization_id)").eq("student_id", studentId).eq("assignments.organization_id", organizationId),
    admin!.from("brain_assignment_submissions").select("status,submitted_at").eq("organization_id", organizationId).eq("user_id", studentId)
  ]);

  const lastWatched = lessonProgress.data?.last_watched_at ? new Date(String(lessonProgress.data.last_watched_at)) : null;
  const daysInactive = lastWatched ? Math.max(0, Math.floor((Date.now() - lastWatched.getTime()) / 86_400_000)) : 999;

  const spaceRows = spaceProgress.data ?? [];
  const progressPercent = spaceRows.length ? Math.round(spaceRows.reduce((sum, row) => sum + Number(row.percent ?? 0), 0) / spaceRows.length) : 0;

  const masteryPercent = calculateOverallMastery(skills);

  const now = Date.now();
  const legacyRows = (legacySubs.data ?? []) as { status: string; submitted_at: string | null; assignments: { due_at: string | null } | { due_at: string | null }[] | null }[];
  const overdueAssignments = legacyRows.filter((row) => {
    const dueAt = Array.isArray(row.assignments) ? row.assignments[0]?.due_at : row.assignments?.due_at;
    return dueAt && new Date(dueAt).getTime() < now && !["graded", "submitted"].includes(row.status);
  }).length;

  const repeatedRevisionCount = legacyRows.filter((row) => row.status === "returned").length +
    ((brainSubs.data ?? []) as { status: string }[]).filter((row) => row.status === "revision_requested").length;

  const waitingSubmitted = [
    ...legacyRows.filter((row) => row.status === "submitted" && row.submitted_at),
    ...((brainSubs.data ?? []) as { status: string; submitted_at: string | null }[]).filter((row) => row.status === "submitted" && row.submitted_at)
  ];
  const feedbackWaitHours = waitingSubmitted.length
    ? Math.max(...waitingSubmitted.map((row) => (now - new Date(row.submitted_at as string).getTime()) / 3_600_000))
    : 0;

  return { daysInactive, progressPercent, overdueAssignments, repeatedRevisionCount, feedbackWaitHours, masteryPercent, lastActivityAt: lastWatched?.toISOString() ?? null };
}

export async function getAssignedStudentSummaries(access: TeachingAccessSnapshot): Promise<StudentSuccessSummary[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  let studentIds = access.assignedStudentIds;
  const classByStudent = new Map<string, string[]>();
  if (access.canViewAllStudents) {
    const { data: memberRows } = await admin.from("class_members").select("user_id,class_id").eq("role", "student").in("status", ["active", "completed"]);
    const orgClassIds = (await admin.from("classes").select("id").eq("organization_id", access.organizationId)).data?.map((r) => String(r.id)) ?? [];
    const orgClassSet = new Set(orgClassIds);
    for (const row of memberRows ?? []) {
      if (!orgClassSet.has(String(row.class_id))) continue;
      const list = classByStudent.get(String(row.user_id)) ?? [];
      list.push(String(row.class_id));
      classByStudent.set(String(row.user_id), list);
    }
    studentIds = [...classByStudent.keys()];
  } else {
    const { data: memberRows } = await admin.from("class_members").select("user_id,class_id").in("class_id", access.assignedClassIds).eq("role", "student").in("status", ["active", "completed"]);
    for (const row of memberRows ?? []) {
      const list = classByStudent.get(String(row.user_id)) ?? [];
      list.push(String(row.class_id));
      classByStudent.set(String(row.user_id), list);
    }
  }
  if (!studentIds.length) return [];

  const { data: profileRows } = await admin.from("profiles").select("id,full_name,avatar_url").in("id", studentIds);
  const profileById = new Map((profileRows ?? []).map((row) => [String(row.id), row]));

  const summaries = await Promise.all(studentIds.map(async (studentId) => {
    const signals = await computeSignals(admin, access.organizationId, studentId);
    const risk = assessStudentRisk({ studentId, ...signals });
    const profile = profileById.get(studentId);
    return {
      studentId,
      name: String(profile?.full_name || "Học viên"),
      avatarUrl: profile?.avatar_url ? String(profile.avatar_url) : null,
      classIds: classByStudent.get(studentId) ?? [],
      progressPercent: signals.progressPercent,
      masteryPercent: signals.masteryPercent,
      lastActivityAt: signals.lastActivityAt,
      overdueAssignments: signals.overdueAssignments,
      risk
    } satisfies StudentSuccessSummary;
  }));

  return summaries.sort((a, b) => b.risk.score - a.risk.score);
}

export async function getStudentInterventions(access: TeachingAccessSnapshot, studentId: string): Promise<StudentInterventionRow[]> {
  if (!canAccessStudent(access, studentId)) return [];
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("teach_student_interventions")
    .select("id,student_user_id,teacher_user_id,class_id,risk_level,reason_codes,action_type,note,status,due_at,completed_at,created_at")
    .eq("organization_id", access.organizationId)
    .eq("student_user_id", studentId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: String(row.id),
    studentUserId: String(row.student_user_id),
    teacherUserId: String(row.teacher_user_id),
    classId: row.class_id ? String(row.class_id) : null,
    riskLevel: String(row.risk_level),
    reasonCodes: (row.reason_codes ?? []) as string[],
    actionType: String(row.action_type),
    note: row.note ? String(row.note) : null,
    status: String(row.status),
    dueAt: row.due_at ? String(row.due_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at)
  }));
}
