import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { TeachingAccessSnapshot, TeachingRole } from "./types";

// Server-only TeachingAccessSnapshot (H2OBOOK Teaching Intelligence Center V1, adapted). Built
// entirely from the already-verified role/organization membership returned by
// resolveOrganizationAccess() (lib/auth/api.ts) — never from client state, query params or the
// display role. 'student' and any other non-teaching role gets null (no Teach access at all).
//
// Scope model: instead of introducing a parallel teach_scope_assignments table, a teacher's
// scope is exactly the classes where public.classes.teacher_id is them, and the active members
// of those classes. Owner/admin see everything in the organization. This mirrors the pre-existing
// convention (classes.teacher_id already existed in migration 0002); see the migration 0029
// header comment for why the reference module's role/scope tables were not ported.
export async function getTeachingAccessSnapshot(
  user: CurrentUser,
  organizationId: string,
  role: string
): Promise<TeachingAccessSnapshot | null> {
  if (role !== "teacher" && role !== "admin" && role !== "owner") return null;
  const teachingRole = role as TeachingRole;

  if (teachingRole === "admin" || teachingRole === "owner") {
    return {
      userId: user.id,
      organizationId,
      role: teachingRole,
      assignedClassIds: [],
      assignedStudentIds: [],
      canViewAllStudents: true,
      canViewAllClasses: true
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data: classRows } = await admin
    .from("classes")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("teacher_id", user.id);
  const assignedClassIds = (classRows ?? []).map((row) => String(row.id));

  let assignedStudentIds: string[] = [];
  if (assignedClassIds.length) {
    const { data: memberRows } = await admin
      .from("class_members")
      .select("user_id")
      .in("class_id", assignedClassIds)
      .eq("role", "student")
      .in("status", ["active", "completed"]);
    assignedStudentIds = [...new Set((memberRows ?? []).map((row) => String(row.user_id)))];
  }

  return {
    userId: user.id,
    organizationId,
    role: teachingRole,
    assignedClassIds,
    assignedStudentIds,
    canViewAllStudents: false,
    canViewAllClasses: false
  };
}

// Every students/[id]-style lookup must call this before touching any per-student table —
// the single enforcement point for "instructors cannot enumerate or fetch unassigned students."
export function canAccessStudent(access: TeachingAccessSnapshot, studentId: string): boolean {
  return access.canViewAllStudents || access.assignedStudentIds.includes(studentId);
}

export function canAccessClass(access: TeachingAccessSnapshot, classId: string): boolean {
  return access.canViewAllClasses || access.assignedClassIds.includes(classId);
}
