import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TeachingAccessSnapshot } from "./types";

export interface TeachingClassSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  studentCount: number;
  avgProgressPercent: number;
  atRiskCount: number;
}

export async function getTeachingClasses(access: TeachingAccessSnapshot): Promise<TeachingClassSummary[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  let classQuery = admin.from("classes").select("id,name,code,status").eq("organization_id", access.organizationId);
  if (!access.canViewAllClasses) classQuery = classQuery.eq("teacher_id", access.userId);
  const { data: classRows } = await classQuery.order("created_at", { ascending: false });
  const classes = classRows ?? [];
  if (!classes.length) return [];

  const classIds = classes.map((row) => String(row.id));
  const { data: memberRows } = await admin.from("class_members").select("class_id,user_id").in("class_id", classIds).eq("role", "student").in("status", ["active", "completed"]);
  const studentsByClass = new Map<string, string[]>();
  for (const row of memberRows ?? []) {
    const list = studentsByClass.get(String(row.class_id)) ?? [];
    list.push(String(row.user_id));
    studentsByClass.set(String(row.class_id), list);
  }

  const allStudentIds = [...new Set((memberRows ?? []).map((row) => String(row.user_id)))];
  const { data: progressRows } = allStudentIds.length
    ? await admin.from("knowledge_space_progress").select("user_id,percent").eq("organization_id", access.organizationId).in("user_id", allStudentIds)
    : { data: [] as { user_id: string; percent: number }[] };
  const progressByStudent = new Map<string, number[]>();
  for (const row of progressRows ?? []) {
    const list = progressByStudent.get(String(row.user_id)) ?? [];
    list.push(Number(row.percent ?? 0));
    progressByStudent.set(String(row.user_id), list);
  }

  return classes.map((row) => {
    const studentIds = studentsByClass.get(String(row.id)) ?? [];
    const progresses = studentIds.map((id) => {
      const values = progressByStudent.get(id) ?? [];
      return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    });
    const avgProgressPercent = progresses.length ? Math.round(progresses.reduce((sum, v) => sum + v, 0) / progresses.length) : 0;
    const atRiskCount = progresses.filter((p) => p < 40).length;
    return {
      id: String(row.id),
      name: String(row.name),
      code: String(row.code),
      status: String(row.status),
      studentCount: studentIds.length,
      avgProgressPercent,
      atRiskCount
    };
  });
}
