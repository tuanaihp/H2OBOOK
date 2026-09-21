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
  teacherName: string;
  startDate: string | null;
  endDate: string | null;
  color: string | null;
  bookCount: number;
}

const CLASS_STATUSES = new Set(["upcoming", "active", "completed", "archived"]);

export interface AcademyStudentCandidate {
  studentId: string;
  name: string;
  email: string;
  enrolled: boolean;
  entitlementCount: number;
}

export async function createTeachingClass(access: TeachingAccessSnapshot, input: { name: string; code?: string; totalSessions?: number; startDate?: string; endDate?: string; color?: string; status?: string; bookIds?: string[] }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const name = input.name.trim();
  const code = (input.code?.trim() || `H2B-${Date.now().toString(36).toUpperCase().slice(-6)}`).toUpperCase();
  const totalSessions = Math.min(200, Math.max(1, Math.round(input.totalSessions ?? 60)));
  if (!name) return { ok: false as const, error: "CLASS_NAME_AND_CODE_REQUIRED" };
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const startDate = input.startDate && datePattern.test(input.startDate) ? input.startDate : null;
  const endDate = input.endDate && datePattern.test(input.endDate) ? input.endDate : null;
  const status = input.status && CLASS_STATUSES.has(input.status) ? input.status : "active";

  const { data, error } = await supabase.from("classes").insert({
    organization_id: access.organizationId,
    name,
    code,
    teacher_id: access.userId,
    total_sessions: totalSessions,
    status,
    start_date: startDate,
    end_date: endDate,
    color: input.color?.trim() || null,
    created_by: access.userId
  }).select("id,name,code,status,start_date,end_date,color").single();
  if (error || !data) return { ok: false as const, error: error?.code === "23505" ? "CLASS_CODE_ALREADY_EXISTS" : (error?.message ?? "CLASS_CREATE_FAILED") };

  // Clients send book client_keys (the ids the workspace UI uses); class_books.book_id is the
  // server uuid, so resolve through the books table and skip anything outside this organization.
  let bookCount = 0;
  const requestedBookIds = (input.bookIds ?? []).map((id) => String(id).trim()).filter(Boolean).slice(0, 50);
  if (requestedBookIds.length) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
    const uuids = requestedBookIds.filter((id) => uuidPattern.test(id));
    const clientKeys = requestedBookIds.filter((id) => !uuidPattern.test(id));
    const booksQuery = supabase.from("books").select("id,client_key").eq("organization_id", access.organizationId).is("deleted_at", null);
    const orClauses = [
      ...(uuids.length ? [`id.in.(${uuids.join(",")})`] : []),
      ...(clientKeys.length ? [`client_key.in.(${clientKeys.map((key) => `"${key.replace(/"/g, "")}"`).join(",")})`] : [])
    ];
    const { data: bookRows } = orClauses.length ? await booksQuery.or(orClauses.join(",")) : { data: [] };
    const resolvedIds = [...new Set((bookRows ?? []).map((row) => String(row.id)))];
    if (resolvedIds.length) {
      const { error: linkError } = await supabase.from("class_books").insert(
        resolvedIds.map((bookId, position) => ({ class_id: data.id, book_id: bookId, position }))
      );
      if (!linkError) bookCount = resolvedIds.length;
    }
  }
  return { ok: true as const, klass: { id: String(data.id), name: String(data.name), code: String(data.code), status: String(data.status), studentCount: 0, startDate: data.start_date ?? null, endDate: data.end_date ?? null, color: data.color ?? null, bookCount } };
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

  let classQuery = admin.from("classes").select("id,name,code,status,teacher_id,start_date,end_date,color").eq("organization_id", access.organizationId);
  if (!access.canViewAllClasses) classQuery = classQuery.eq("teacher_id", access.userId);
  const { data: classRows } = await classQuery.order("created_at", { ascending: false });
  const classes = classRows ?? [];
  if (!classes.length) return [];

  const classIds = classes.map((row) => String(row.id));
  const teacherIds = [...new Set(classes.map((row) => row.teacher_id).filter(Boolean).map(String))];
  const [{ data: memberRows }, { data: bookRows }, { data: teacherRows }] = await Promise.all([
    admin.from("class_members").select("class_id,user_id").in("class_id", classIds).eq("role", "student").in("status", ["active", "completed"]),
    admin.from("class_books").select("class_id").in("class_id", classIds),
    teacherIds.length ? admin.from("profiles").select("id,full_name").in("id", teacherIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] })
  ]);
  const studentsByClass = new Map<string, string[]>();
  for (const row of memberRows ?? []) {
    const list = studentsByClass.get(String(row.class_id)) ?? [];
    list.push(String(row.user_id));
    studentsByClass.set(String(row.class_id), list);
  }
  const bookCountByClass = new Map<string, number>();
  for (const row of bookRows ?? []) bookCountByClass.set(String(row.class_id), (bookCountByClass.get(String(row.class_id)) ?? 0) + 1);
  const teacherNameById = new Map((teacherRows ?? []).map((row) => [String(row.id), String(row.full_name ?? "")]));

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
      atRiskCount,
      teacherName: row.teacher_id ? (teacherNameById.get(String(row.teacher_id)) ?? "") : "",
      startDate: row.start_date ? String(row.start_date) : null,
      endDate: row.end_date ? String(row.end_date) : null,
      color: row.color ? String(row.color) : null,
      bookCount: bookCountByClass.get(String(row.id)) ?? 0
    };
  });
}
