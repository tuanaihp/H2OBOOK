import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessClass } from "./access";
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

export interface AcademyStudentCandidate {
  studentId: string;
  name: string;
  email: string;
  enrolled: boolean;
  entitlementCount: number;
}

export async function createTeachingClass(access: TeachingAccessSnapshot, input: { name: string; code: string; totalSessions?: number }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  const totalSessions = Math.min(200, Math.max(1, Math.round(input.totalSessions ?? 60)));
  if (!name || !code) return { ok: false as const, error: "CLASS_NAME_AND_CODE_REQUIRED" };

  const { data, error } = await supabase.from("classes").insert({
    organization_id: access.organizationId,
    name,
    code,
    teacher_id: access.userId,
    total_sessions: totalSessions,
    status: "active",
    created_by: access.userId
  }).select("id,name,code,status").single();
  if (error || !data) return { ok: false as const, error: error?.code === "23505" ? "CLASS_CODE_ALREADY_EXISTS" : (error?.message ?? "CLASS_CREATE_FAILED") };
  return { ok: true as const, klass: { id: String(data.id), name: String(data.name), code: String(data.code), status: String(data.status), studentCount: 0 } };
}

export async function listAcademyStudentCandidates(access: TeachingAccessSnapshot, classId: string): Promise<AcademyStudentCandidate[] | null> {
  if (!canAccessClass(access, classId)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const [{ data: memberRows }, { data: enrolledRows }, { data: entitlementRows }] = await Promise.all([
    admin.from("organization_members").select("user_id").eq("organization_id", access.organizationId).eq("role", "student").eq("status", "active"),
    admin.from("class_members").select("user_id").eq("class_id", classId).eq("role", "student").in("status", ["active", "completed"]),
    admin.from("entitlements").select("user_id").eq("organization_id", access.organizationId).eq("status", "active")
  ]);
  const studentIds = [...new Set((memberRows ?? []).map((row) => String(row.user_id)))];
  if (!studentIds.length) return [];
  const { data: profileRows } = await admin.from("profiles").select("id,full_name,email").in("id", studentIds);
  const profiles = new Map((profileRows ?? []).map((row) => [String(row.id), row]));
  const enrolled = new Set((enrolledRows ?? []).map((row) => String(row.user_id)));
  const entitlementCounts = new Map<string, number>();
  for (const row of entitlementRows ?? []) {
    const userId = String(row.user_id);
    entitlementCounts.set(userId, (entitlementCounts.get(userId) ?? 0) + 1);
  }
  return studentIds.map((studentId) => {
    const profile = profiles.get(studentId);
    return {
      studentId,
      name: String(profile?.full_name || profile?.email || "Học viên"),
      email: String(profile?.email || ""),
      enrolled: enrolled.has(studentId),
      entitlementCount: entitlementCounts.get(studentId) ?? 0
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function enrollAcademyStudent(access: TeachingAccessSnapshot, classId: string, studentId: string) {
  if (!canAccessClass(access, classId)) return { ok: false as const, error: "FORBIDDEN_CLASS_SCOPE" };
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { data: student } = await admin.from("organization_members").select("user_id").eq("organization_id", access.organizationId)
    .eq("user_id", studentId).eq("role", "student").eq("status", "active").maybeSingle();
  if (!student) return { ok: false as const, error: "ACADEMY_STUDENT_NOT_FOUND" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("class_members").upsert({
    class_id: classId,
    user_id: studentId,
    role: "student",
    status: "active",
    joined_at: new Date().toISOString()
  }, { onConflict: "class_id,user_id" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function updateClassMemberStatus(access: TeachingAccessSnapshot, classId: string, studentId: string, status: "active" | "paused" | "completed" | "removed") {
  if (!canAccessClass(access, classId)) return { ok: false as const, error: "FORBIDDEN_CLASS_SCOPE" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { data, error } = await supabase.from("class_members").update({ status }).eq("class_id", classId).eq("user_id", studentId).eq("role", "student").select("id").maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "CLASS_MEMBER_NOT_FOUND" };
  return { ok: true as const };
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
