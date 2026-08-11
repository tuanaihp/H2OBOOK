import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MissionBlock, MissionWorkspaceConfig, StudentBlockValue } from "./types";

type ConfigRow = { id: string; journey_version_id: string; mission_id: string; schema_version: string; blocks: MissionBlock[]; updated_at: string };

export async function getWorkspaceConfig(organizationId: string, journeyVersionId: string, missionId: string): Promise<MissionWorkspaceConfig | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("learning_mission_workspace_configs").select("id,journey_version_id,mission_id,schema_version,blocks,updated_at")
    .eq("organization_id", organizationId).eq("journey_version_id", journeyVersionId).eq("mission_id", missionId).maybeSingle();
  if (!data) return null;
  const row = data as ConfigRow;
  return { id: row.id, journeyVersionId: row.journey_version_id, missionId: row.mission_id, schemaVersion: row.schema_version, blocks: row.blocks ?? [], updatedAt: row.updated_at };
}

/** Every workspace config for a version in one query — for the Preflight V2 extension and any "does every mission have a workspace" summary. */
export async function getWorkspaceConfigsForVersion(organizationId: string, journeyVersionId: string): Promise<Map<string, MissionWorkspaceConfig>> {
  const admin = createSupabaseAdminClient();
  const map = new Map<string, MissionWorkspaceConfig>();
  if (!admin) return map;
  const { data } = await admin.from("learning_mission_workspace_configs").select("id,journey_version_id,mission_id,schema_version,blocks,updated_at")
    .eq("organization_id", organizationId).eq("journey_version_id", journeyVersionId);
  for (const row of (data ?? []) as ConfigRow[]) map.set(row.mission_id, { id: row.id, journeyVersionId: row.journey_version_id, missionId: row.mission_id, schemaVersion: row.schema_version, blocks: row.blocks ?? [], updatedAt: row.updated_at });
  return map;
}

export async function getStudentBlockValues(organizationId: string, studentId: string, journeyVersionId: string, missionId: string): Promise<StudentBlockValue[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("student_mission_workspace_values").select("block_id,value,status,updated_at")
    .eq("organization_id", organizationId).eq("student_id", studentId).eq("journey_version_id", journeyVersionId).eq("mission_id", missionId);
  return ((data ?? []) as { block_id: string; value: unknown; status: string; updated_at: string }[])
    .map((r) => ({ blockId: r.block_id, value: r.value, status: r.status as "draft" | "saved", updatedAt: r.updated_at }));
}

/**
 * Every one of this student's block values for a version, grouped by mission — one query for the
 * whole Smart Journey Shell read model (docs/smart-journey-v3 §4/§12: "batch query; no N+1") instead
 * of one query per mission when computing every mission's readiness score for Map/List views.
 */
export async function getStudentBlockValuesForVersion(organizationId: string, studentId: string, journeyVersionId: string): Promise<Map<string, StudentBlockValue[]>> {
  const admin = createSupabaseAdminClient();
  const map = new Map<string, StudentBlockValue[]>();
  if (!admin) return map;
  const { data } = await admin.from("student_mission_workspace_values").select("mission_id,block_id,value,status,updated_at")
    .eq("organization_id", organizationId).eq("student_id", studentId).eq("journey_version_id", journeyVersionId);
  for (const row of (data ?? []) as { mission_id: string; block_id: string; value: unknown; status: string; updated_at: string }[]) {
    const list = map.get(row.mission_id) ?? [];
    list.push({ blockId: row.block_id, value: row.value, status: row.status as "draft" | "saved", updatedAt: row.updated_at });
    map.set(row.mission_id, list);
  }
  return map;
}
