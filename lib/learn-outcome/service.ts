import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  JourneyBlueprint, JourneyBlueprintVersion, JourneyMilestone, JourneyMission, JourneyOutcome,
  MissionAssignmentBinding, MissionActionTemplate, MissionResourceBinding, MissionToolBinding
} from "./types";

type BlueprintRow = { id: string; stage_id: string; title: string; current_published_version_id: string | null };
type VersionRow = { id: string; blueprint_id: string; version_number: number; status: string; published_at: string | null; created_by: string | null; created_at: string };
type OutcomeRow = { id: string; version_id: string; title: string; description: string | null; position: number };
type MilestoneRow = { id: string; outcome_id: string; title: string; description: string | null; position: number };
type MissionRow = {
  id: string; milestone_id: string; title: string; description: string | null; expected_result: string;
  estimated_days: number | null; prerequisite_mission_id: string | null; completion_policy: string;
  success_criteria: string[] | null; evidence_policy: Record<string, unknown> | null; position: number;
};
type ResourceBindingRow = { id: string; mission_id: string; resource_type: string; resource_id: string; role: string; position: number };
type ToolBindingRow = { id: string; mission_id: string; tool_type: string; tool_id: string; role: string; position: number };
type AssignmentBindingRow = { id: string; mission_id: string; assignment_id: string; role: string; position: number };
type ActionTemplateRow = { id: string; mission_id: string; title: string; description: string | null; required: boolean; day_offset: number | null; evidence_required: boolean; position: number };

function mapBlueprint(row: BlueprintRow): JourneyBlueprint {
  return { id: row.id, stageId: row.stage_id, title: row.title, currentPublishedVersionId: row.current_published_version_id };
}
function mapVersion(row: VersionRow): JourneyBlueprintVersion {
  return { id: row.id, blueprintId: row.blueprint_id, versionNumber: row.version_number, status: row.status as JourneyBlueprintVersion["status"], publishedAt: row.published_at, createdBy: row.created_by, createdAt: row.created_at };
}

/** The blueprint for a stage, if Admin has created one — one blueprint per stage (migration 0050). */
export async function loadBlueprintForStage(organizationId: string, stageId: string): Promise<JourneyBlueprint | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("learning_journey_blueprints").select("id,stage_id,title,current_published_version_id").eq("organization_id", organizationId).eq("stage_id", stageId).maybeSingle();
  return data ? mapBlueprint(data as BlueprintRow) : null;
}

export async function listBlueprintVersions(organizationId: string, blueprintId: string): Promise<JourneyBlueprintVersion[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("learning_journey_versions").select("id,blueprint_id,version_number,status,published_at,created_by,created_at").eq("organization_id", organizationId).eq("blueprint_id", blueprintId).order("version_number", { ascending: false });
  return ((data ?? []) as VersionRow[]).map(mapVersion);
}

/**
 * The full nested graph for one version — everything the Admin canvas or a student's Journey Map
 * read needs, in six queries regardless of how many outcomes/milestones/missions exist (batched by
 * version/outcome/milestone ids, not one query per node — the same shape as
 * lib/academy-control/service.ts's loadAllStageNodes for the same reason).
 */
export async function loadVersionGraph(organizationId: string, versionId: string): Promise<JourneyOutcome[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data: outcomeRows } = await admin.from("learning_journey_outcomes").select("id,version_id,title,description,position").eq("organization_id", organizationId).eq("version_id", versionId).order("position", { ascending: true });
  const outcomes = (outcomeRows ?? []) as OutcomeRow[];
  const outcomeIds = outcomes.map((o) => o.id);
  if (!outcomeIds.length) return [];

  const { data: milestoneRows } = await admin.from("learning_journey_milestones").select("id,outcome_id,title,description,position").eq("organization_id", organizationId).in("outcome_id", outcomeIds).order("position", { ascending: true });
  const milestones = (milestoneRows ?? []) as MilestoneRow[];
  const milestoneIds = milestones.map((m) => m.id);

  const [{ data: missionRows }, { data: resourceRows }, { data: toolRows }, { data: assignmentRows }, { data: actionRows }] = milestoneIds.length
    ? await Promise.all([
        admin.from("learning_journey_missions").select("id,milestone_id,title,description,expected_result,estimated_days,prerequisite_mission_id,completion_policy,success_criteria,evidence_policy,position").eq("organization_id", organizationId).in("milestone_id", milestoneIds).order("position", { ascending: true }),
        admin.from("learning_mission_resource_bindings").select("id,mission_id,resource_type,resource_id,role,position").eq("organization_id", organizationId),
        admin.from("learning_mission_tool_bindings").select("id,mission_id,tool_type,tool_id,role,position").eq("organization_id", organizationId),
        admin.from("learning_mission_assignment_bindings").select("id,mission_id,assignment_id,role,position").eq("organization_id", organizationId),
        admin.from("learning_mission_action_templates").select("id,mission_id,title,description,required,day_offset,evidence_required,position").eq("organization_id", organizationId)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const missions = (missionRows ?? []) as MissionRow[];
  const missionIds = new Set(missions.map((m) => m.id));
  const resourceBindings = ((resourceRows ?? []) as ResourceBindingRow[]).filter((r) => missionIds.has(r.mission_id));
  const toolBindings = ((toolRows ?? []) as ToolBindingRow[]).filter((r) => missionIds.has(r.mission_id));
  const assignmentBindings = ((assignmentRows ?? []) as AssignmentBindingRow[]).filter((r) => missionIds.has(r.mission_id));
  const actionTemplates = ((actionRows ?? []) as ActionTemplateRow[]).filter((r) => missionIds.has(r.mission_id));

  const mapMission = (row: MissionRow): JourneyMission => ({
    id: row.id, milestoneId: row.milestone_id, title: row.title, description: row.description ?? "",
    expectedResult: row.expected_result, estimatedDays: row.estimated_days, prerequisiteMissionId: row.prerequisite_mission_id,
    completionPolicy: row.completion_policy as JourneyMission["completionPolicy"],
    successCriteria: Array.isArray(row.success_criteria) ? row.success_criteria : [],
    evidencePolicy: row.evidence_policy ?? {}, position: row.position,
    resourceBindings: resourceBindings.filter((b) => b.mission_id === row.id).sort((a, b) => a.position - b.position)
      .map((b): MissionResourceBinding => ({ id: b.id, missionId: b.mission_id, resourceType: b.resource_type, resourceId: b.resource_id, role: b.role as MissionResourceBinding["role"], position: b.position })),
    toolBindings: toolBindings.filter((b) => b.mission_id === row.id).sort((a, b) => a.position - b.position)
      .map((b): MissionToolBinding => ({ id: b.id, missionId: b.mission_id, toolType: b.tool_type, toolId: b.tool_id, role: b.role as MissionToolBinding["role"], position: b.position })),
    assignmentBindings: assignmentBindings.filter((b) => b.mission_id === row.id).sort((a, b) => a.position - b.position)
      .map((b): MissionAssignmentBinding => ({ id: b.id, missionId: b.mission_id, assignmentId: b.assignment_id, role: b.role as MissionAssignmentBinding["role"], position: b.position })),
    actionTemplates: actionTemplates.filter((a) => a.mission_id === row.id).sort((a, b) => a.position - b.position)
      .map((a): MissionActionTemplate => ({ id: a.id, missionId: a.mission_id, title: a.title, description: a.description ?? "", required: a.required, dayOffset: a.day_offset, evidenceRequired: a.evidence_required, position: a.position }))
  });

  const mapMilestone = (row: MilestoneRow): JourneyMilestone => ({
    id: row.id, outcomeId: row.outcome_id, title: row.title, description: row.description ?? "", position: row.position,
    missions: missions.filter((m) => m.milestone_id === row.id).sort((a, b) => a.position - b.position).map(mapMission)
  });

  return outcomes.map((row): JourneyOutcome => ({
    id: row.id, versionId: row.version_id, title: row.title, description: row.description ?? "", position: row.position,
    milestones: milestones.filter((m) => m.outcome_id === row.id).sort((a, b) => a.position - b.position).map(mapMilestone)
  }));
}

/**
 * Resolves resource_id -> real title for a batch of bindings in two queries total (one per
 * resource_type present), not one per binding — the same batching shape as loadVersionGraph. Used
 * by both the student read model and the Admin Journey Builder so "no UUID as the primary label" is
 * one implementation, not two that could drift.
 */
export async function resolveResourceTitles(organizationId: string, bindings: { resourceType: string; resourceId: string }[]): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient();
  const titleById = new Map<string, string>();
  if (!admin || !bindings.length) return titleById;
  const documentIds = [...new Set(bindings.filter((b) => b.resourceType === "document").map((b) => b.resourceId))];
  const placementIds = [...new Set(bindings.filter((b) => b.resourceType === "career_stage_resource").map((b) => b.resourceId))];
  const [{ data: documentRows }, { data: placementRows }] = await Promise.all([
    documentIds.length ? admin.from("curriculum_documents").select("id,title").eq("organization_id", organizationId).in("id", documentIds) : Promise.resolve({ data: [] }),
    placementIds.length ? admin.from("career_stage_resources").select("id,title_override").eq("organization_id", organizationId).in("id", placementIds) : Promise.resolve({ data: [] })
  ]);
  for (const row of (documentRows ?? []) as { id: string; title: string }[]) titleById.set(row.id, row.title);
  for (const row of (placementRows ?? []) as { id: string; title_override: string | null }[]) if (row.title_override) titleById.set(row.id, row.title_override);
  return titleById;
}

export interface ResourceSearchResult { resourceType: "document" | "career_stage_resource"; resourceId: string; title: string; summary: string; sourceLabel: string; stageTitle: string }

/**
 * Server-side search for the Journey V2 Resource Picker — title/summary, not resource_id. Searches
 * curriculum_documents directly (the real content) joined against which stage(s) placed it, so the
 * picker can show "Nền tảng nghề Makeup" as a source label the way docs/29's spec asks for, without
 * a resource ever needing to be looked up by id first. Same organization_id scope as every other
 * read here — a picker result can never point outside the caller's own tenant.
 */
export async function searchResourcesForPicker(organizationId: string, query: string, limit = 20): Promise<ResourceSearchResult[]> {
  const admin = createSupabaseAdminClient();
  if (!admin || !query.trim()) return [];
  const { data: documents } = await admin
    .from("curriculum_documents")
    .select("id,title,summary,doc_type")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
    .limit(limit);
  const docs = (documents ?? []) as { id: string; title: string; summary: string; doc_type: string }[];
  if (!docs.length) return [];

  const docIds = docs.map((d) => d.id);
  const { data: placements } = await admin
    .from("career_stage_resources")
    .select("resource_id,stage_id")
    .eq("organization_id", organizationId)
    .eq("resource_type", "document")
    .in("resource_id", docIds);
  const stageIds = [...new Set(((placements ?? []) as { stage_id: string }[]).map((p) => p.stage_id))];
  const { data: stages } = stageIds.length ? await admin.from("career_stages").select("id,title").in("id", stageIds) : { data: [] };
  const stageTitleById = new Map(((stages ?? []) as { id: string; title: string }[]).map((s) => [s.id, s.title]));
  const stageTitleByDocId = new Map<string, string>();
  for (const p of (placements ?? []) as { resource_id: string; stage_id: string }[]) {
    if (!stageTitleByDocId.has(p.resource_id)) stageTitleByDocId.set(p.resource_id, stageTitleById.get(p.stage_id) ?? "");
  }

  return docs.map((d): ResourceSearchResult => ({
    resourceType: "document", resourceId: d.id, title: d.title, summary: d.summary,
    sourceLabel: d.doc_type, stageTitle: stageTitleByDocId.get(d.id) ?? "Chưa đặt vào giai đoạn nào"
  }));
}

/** The published journey for a stage, if any — what a student's Tab 1 (Release B) will read. */
export async function getPublishedJourneyForStage(organizationId: string, stageId: string): Promise<{ blueprint: JourneyBlueprint; version: JourneyBlueprintVersion; outcomes: JourneyOutcome[] } | null> {
  const blueprint = await loadBlueprintForStage(organizationId, stageId);
  if (!blueprint?.currentPublishedVersionId) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("learning_journey_versions").select("id,blueprint_id,version_number,status,published_at,created_by,created_at").eq("id", blueprint.currentPublishedVersionId).maybeSingle();
  if (!data) return null;
  const outcomes = await loadVersionGraph(organizationId, blueprint.currentPublishedVersionId);
  return { blueprint, version: mapVersion(data as VersionRow), outcomes };
}
