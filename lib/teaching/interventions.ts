import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessStudent } from "./access";
import type { TeachingAccessSnapshot } from "./types";

export interface CreateInterventionInput {
  studentId: string;
  classId?: string;
  riskLevel: "watch" | "attention" | "critical";
  reasonCodes: string[];
  actionType: "message" | "assignment" | "meeting" | "resource" | "stage_review" | "other";
  note?: string;
  dueAt?: string;
}

export async function createIntervention(access: TeachingAccessSnapshot, input: CreateInterventionInput) {
  if (access.role === "teacher" && !canAccessStudent(access, input.studentId)) return { ok: false as const, error: "FORBIDDEN_STUDENT_SCOPE" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { data, error } = await supabase.from("teach_student_interventions").insert({
    organization_id: access.organizationId,
    student_user_id: input.studentId,
    teacher_user_id: access.userId,
    class_id: input.classId ?? null,
    risk_level: input.riskLevel,
    reason_codes: input.reasonCodes,
    action_type: input.actionType,
    note: input.note ?? null,
    due_at: input.dueAt ?? null,
    created_by: access.userId
  }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "INTERVENTION_CREATE_FAILED" };
  return { ok: true as const, id: String(data.id) };
}

export async function completeIntervention(access: TeachingAccessSnapshot, interventionId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase
    .from("teach_student_interventions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", interventionId)
    .eq("organization_id", access.organizationId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
