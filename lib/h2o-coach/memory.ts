import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LearnerMemoryValue, MemoryValueStatus } from "./types";

function namespaceOf(fieldKey: string): string {
  return fieldKey.split(".")[0] || fieldKey;
}

interface Row {
  field_key: string; namespace: string; value: unknown; status: MemoryValueStatus;
  confidence: number | null; source_mission_id: string | null; source_message_id: string | null; updated_at: string;
}
function toValue(row: Row): LearnerMemoryValue {
  return { field: row.field_key, namespace: row.namespace, value: row.value, status: row.status, confidence: row.confidence, sourceMissionId: row.source_mission_id, sourceMessageId: row.source_message_id, updatedAt: row.updated_at };
}

/** Every memory value the learner has, across every Mission/Stage — the whole point of namespaced memory is Mission 2 can read what Mission 1 confirmed without re-asking. */
export async function getLearnerMemory(organizationId: string, learnerId: string): Promise<LearnerMemoryValue[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("learner_memory_values")
    .select("field_key,namespace,value,status,confidence,source_mission_id,source_message_id,updated_at")
    .eq("organization_id", organizationId).eq("learner_id", learnerId);
  return ((data ?? []) as Row[]).map(toValue);
}

/**
 * Upserts candidate memory from one Coach turn. Runs under the learner's own session — unlike
 * learning_skill_evidence (self-insert only), learner_memory_values' "self write" RLS policy is FOR
 * ALL with `with check (learner_id = auth.uid())`, so a student's own session covers both the insert
 * and the ON CONFLICT UPDATE branch; no admin-client workaround needed here.
 */
export async function saveProposedMemory(organizationId: string, learnerId: string, missionId: string, values: { field: string; value: unknown; status: MemoryValueStatus; confidence?: number; sourceMessageId?: string }[]): Promise<void> {
  if (!values.length) return;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.from("learner_memory_values").upsert(
    values.map((v) => ({
      organization_id: organizationId, learner_id: learnerId, namespace: namespaceOf(v.field), field_key: v.field,
      value: v.value, status: v.status, confidence: v.confidence ?? null, source_mission_id: missionId,
      source_message_id: v.sourceMessageId ?? null, updated_by: learnerId
    })),
    { onConflict: "organization_id,learner_id,field_key" }
  );
}

export async function confirmMemoryValue(organizationId: string, learnerId: string, field: string, value?: unknown): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  const patch: Record<string, unknown> = { status: "confirmed", updated_by: learnerId };
  if (value !== undefined) patch.value = value;
  await supabase.from("learner_memory_values").update(patch).eq("organization_id", organizationId).eq("learner_id", learnerId).eq("field_key", field);
}

export async function rejectMemoryValue(organizationId: string, learnerId: string, field: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.from("learner_memory_values").update({ status: "rejected", updated_by: learnerId }).eq("organization_id", organizationId).eq("learner_id", learnerId).eq("field_key", field);
}
