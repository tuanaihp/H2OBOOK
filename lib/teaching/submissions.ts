import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TeachingAccessSnapshot } from "./types";

export interface SubmissionQueueRow {
  id: string;
  source: "legacy" | "brain";
  title: string;
  studentId: string;
  studentName: string;
  status: string;
  submittedAt: string | null;
  dueAt: string | null;
  maxScore: number;
}

// Feedback Studio's unified queue (CLAUDE_INTEGRATION_PROMPT.md §F: "Connect existing submissions
// and rubrics") — merges the legacy classroom assignment_submissions (0002) with the newer
// Knowledge Space brain_assignment_submissions (0026) rather than building a third table.
export async function getSubmissionQueue(access: TeachingAccessSnapshot): Promise<SubmissionQueueRow[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const rows: SubmissionQueueRow[] = [];

  let classIds = access.assignedClassIds;
  if (access.canViewAllClasses) {
    const { data } = await admin.from("classes").select("id").eq("organization_id", access.organizationId);
    classIds = (data ?? []).map((row) => String(row.id));
  }
  if (classIds.length) {
    const { data: legacyRows } = await admin
      .from("assignment_submissions")
      .select("id,student_id,status,submitted_at,assignments!inner(class_id,title,due_at,max_score)")
      .in("assignments.class_id", classIds)
      .eq("status", "submitted");
    for (const row of (legacyRows ?? []) as { id: string; student_id: string; status: string; submitted_at: string | null; assignments: { title: string; due_at: string | null; max_score: number } | { title: string; due_at: string | null; max_score: number }[] }[]) {
      const assignment = Array.isArray(row.assignments) ? row.assignments[0] : row.assignments;
      rows.push({ id: String(row.id), source: "legacy", title: assignment?.title ?? "Bài tập", studentId: String(row.student_id), studentName: "", status: row.status, submittedAt: row.submitted_at, dueAt: assignment?.due_at ?? null, maxScore: Number(assignment?.max_score ?? 100) });
    }
  }

  let studentIds = access.assignedStudentIds;
  if (access.canViewAllStudents) {
    const { data } = await admin.from("class_members").select("user_id,class_id,classes!inner(organization_id)").eq("role", "student").eq("classes.organization_id", access.organizationId);
    studentIds = [...new Set((data ?? []).map((row) => String(row.user_id)))];
  }
  if (studentIds.length) {
    const { data: brainRows } = await admin
      .from("brain_assignment_submissions")
      .select("id,user_id,status,submitted_at,assignment_definitions(title,max_score)")
      .eq("organization_id", access.organizationId)
      .in("user_id", studentIds)
      .eq("status", "submitted");
    for (const row of (brainRows ?? []) as { id: string; user_id: string; status: string; submitted_at: string | null; assignment_definitions: { title: string; max_score: number } | { title: string; max_score: number }[] | null }[]) {
      const def = Array.isArray(row.assignment_definitions) ? row.assignment_definitions[0] : row.assignment_definitions;
      rows.push({ id: String(row.id), source: "brain", title: def?.title ?? "Bài tập Brain Studio", studentId: String(row.user_id), studentName: "", status: row.status, submittedAt: row.submitted_at, dueAt: null, maxScore: Number(def?.max_score ?? 100) });
    }
  }

  if (!rows.length) return rows;
  const { data: profileRows } = await admin.from("profiles").select("id,full_name").in("id", [...new Set(rows.map((r) => r.studentId))]);
  const nameById = new Map((profileRows ?? []).map((row) => [String(row.id), String(row.full_name || "Học viên")]));
  for (const row of rows) row.studentName = nameById.get(row.studentId) ?? "Học viên";

  return rows.sort((a, b) => new Date(a.submittedAt ?? 0).getTime() - new Date(b.submittedAt ?? 0).getTime());
}
