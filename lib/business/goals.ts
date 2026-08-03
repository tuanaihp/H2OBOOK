import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessAccessSnapshot, BusinessGoal } from "./types";

function mapGoal(row: Record<string, unknown>): BusinessGoal {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    title: String(row.title),
    targetValue: Number(row.target_value ?? 0),
    currentValue: Number(row.current_value ?? 0),
    unit: row.unit as BusinessGoal["unit"],
    dueAt: row.due_at ? String(row.due_at) : null,
    status: row.status as BusinessGoal["status"]
  };
}

export async function getMyGoals(access: BusinessAccessSnapshot): Promise<BusinessGoal[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("business_goals").select("*").eq("owner_id", access.userId).eq("status", "active").order("created_at", { ascending: true });
  return (data ?? []).map(mapGoal);
}

export interface CreateGoalInput {
  title: string;
  unit: BusinessGoal["unit"];
  targetValue: number;
  dueAt?: string;
}

export async function createGoal(access: BusinessAccessSnapshot, input: CreateGoalInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { data, error } = await supabase.from("business_goals").insert({
    organization_id: access.organizationId, owner_id: access.userId, title: input.title, unit: input.unit, target_value: input.targetValue, due_at: input.dueAt ?? null
  }).select("*").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "GOAL_CREATE_FAILED" };
  return { ok: true as const, goal: mapGoal(data) };
}

export async function updateGoalProgress(access: BusinessAccessSnapshot, goalId: string, currentValue: number) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("business_goals").update({ current_value: currentValue }).eq("id", goalId).eq("owner_id", access.userId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
