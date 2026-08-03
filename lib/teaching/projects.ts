import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TeachingAccessSnapshot } from "./types";

export interface PendingPortfolioProject {
  id: string;
  title: string;
  recipeSlug: string;
  studentId: string;
  studentName: string;
  readinessScore: number;
  updatedAt: string;
}

export async function getPendingPortfolioProjects(access: TeachingAccessSnapshot): Promise<PendingPortfolioProject[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  let studentIds = access.assignedStudentIds;
  if (access.canViewAllStudents) {
    const { data } = await admin.from("class_members").select("user_id,classes!inner(organization_id)").eq("role", "student").eq("classes.organization_id", access.organizationId);
    studentIds = [...new Set((data ?? []).map((row) => String(row.user_id)))];
  }
  if (!studentIds.length) return [];

  const { data: rows } = await admin
    .from("create_outcome_projects")
    .select("id,title,recipe_slug,owner_user_id,readiness_score,updated_at")
    .eq("organization_id", access.organizationId)
    .in("owner_user_id", studentIds)
    .eq("status", "needs_review")
    .order("updated_at", { ascending: false });
  if (!rows?.length) return [];

  const { data: profileRows } = await admin.from("profiles").select("id,full_name").in("id", [...new Set(rows.map((r) => String(r.owner_user_id)))]);
  const nameById = new Map((profileRows ?? []).map((row) => [String(row.id), String(row.full_name || "Học viên")]));

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    recipeSlug: String(row.recipe_slug),
    studentId: String(row.owner_user_id),
    studentName: nameById.get(String(row.owner_user_id)) ?? "Học viên",
    readinessScore: Number(row.readiness_score ?? 0),
    updatedAt: String(row.updated_at)
  }));
}
