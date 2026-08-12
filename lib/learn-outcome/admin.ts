import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AcademyAdminAccess } from "@/lib/academy-admin/types";
import { loadVersionGraph } from "./service";
import { getWorkspaceConfigsForVersion } from "@/lib/mission-workspace/service";
import { ITEMS_CONFIG_TYPES, MISSION_BLOCK_LABEL } from "@/lib/mission-workspace/types";
import { emitDomainEvent } from "@/lib/domain/events";
import { computeSiblingSwap, findOutsidePrerequisiteReferences } from "./tree-helpers";
import type { MissionBindingRole, MissionInput, PreflightFinding, PreflightResult } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** journey.version_* events (§17) layered on top of the generic domain_events insert trigger — best-effort, never blocks the caller's actual mutation. */
async function emitJourneyEvent(organizationId: string, actorId: string, eventName: string, resourceId: string, payload: Record<string, unknown> = {}): Promise<void> {
  try { await emitDomainEvent({ organizationId, actorId, resourceType: "learning_journey_versions", resourceId, eventName, payload }); } catch { /* best-effort analytics, never fail the caller's write */ }
}

/** Every block type this build can render — anything else in a config is a publish blocker (§17). */
const MISSION_BLOCK_TYPES = new Set(Object.keys(MISSION_BLOCK_LABEL));
/** Types whose config is a list of choices/columns — required + empty list means the student is stuck. */
const ITEMS_REQUIRED_TYPES = ITEMS_CONFIG_TYPES;

async function nextPosition(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, table: string, column: string, value: string): Promise<number> {
  const { data } = await supabase.from(table).select("position").eq(column, value).order("position", { ascending: false }).limit(1).maybeSingle();
  return data ? Number((data as { position: number }).position) + 1 : 0;
}

/** Rejects a write against a version that is not draft — publishing freezes a version's graph. */
async function requireDraftVersion(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, organizationId: string, versionId: string): Promise<Result<null>> {
  const { data } = await supabase.from("learning_journey_versions").select("status").eq("organization_id", organizationId).eq("id", versionId).maybeSingle();
  if (!data) return { ok: false, error: "VERSION_NOT_FOUND" };
  if ((data as { status: string }).status !== "draft") return { ok: false, error: "VERSION_NOT_DRAFT" };
  return { ok: true, data: null };
}

type Sb = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/**
 * Walks Outcome -> Version / Milestone -> Outcome -> Version / Mission -> Milestone -> ... -> Version
 * so every write below can be checked against requireDraftVersion server-side — not just disabled in
 * the UI. docs/journey-tree-editor-v1/01_PRODUCTION_AUDIT.md found createMilestone/createMission/
 * updateMission skipped this (only createOutcome had it), the same class of gap folder 30's Start
 * Mission bypass was: a hidden button is not the same as a server-enforced rule.
 */
async function resolveOutcomeVersion(supabase: Sb, organizationId: string, outcomeId: string): Promise<{ versionId: string } | null> {
  const { data } = await supabase.from("learning_journey_outcomes").select("version_id").eq("organization_id", organizationId).eq("id", outcomeId).maybeSingle();
  return data ? { versionId: (data as { version_id: string }).version_id } : null;
}
async function resolveMilestoneVersion(supabase: Sb, organizationId: string, milestoneId: string): Promise<{ versionId: string; outcomeId: string } | null> {
  const { data } = await supabase.from("learning_journey_milestones").select("outcome_id").eq("organization_id", organizationId).eq("id", milestoneId).maybeSingle();
  if (!data) return null;
  const outcomeId = (data as { outcome_id: string }).outcome_id;
  const resolved = await resolveOutcomeVersion(supabase, organizationId, outcomeId);
  return resolved ? { versionId: resolved.versionId, outcomeId } : null;
}
async function resolveMissionVersion(supabase: Sb, organizationId: string, missionId: string): Promise<{ versionId: string; milestoneId: string } | null> {
  const { data } = await supabase.from("learning_journey_missions").select("milestone_id").eq("organization_id", organizationId).eq("id", missionId).maybeSingle();
  if (!data) return null;
  const milestoneId = (data as { milestone_id: string }).milestone_id;
  const resolved = await resolveMilestoneVersion(supabase, organizationId, milestoneId);
  return resolved ? { versionId: resolved.versionId, milestoneId } : null;
}

/**
 * Safe-delete check for a set of leaf Missions about to be removed (as part of deleting their
 * Outcome or Milestone). Every FK from Mission down to student_mission_states/
 * student_mission_workspace_values is `on delete cascade` — a raw DELETE would silently wipe real
 * student progress/evidence/workspace input with no warning from Postgres. Mirrors the check
 * deleteDraftVersion() already does at the Version level, plus two things that check doesn't need to
 * (it deletes the whole tree, so there is no "outside"):
 *   - student_learning_actions.mission_id (`on delete set null`, not cascade, but still a silent loss
 *     of a real link to the student's own action)
 *   - prerequisite_mission_id from a Mission OUTSIDE this set pointing IN (cross-outcome
 *     prerequisites are allowed since folder 30 — deleting would silently null another Mission's
 *     unlock condition)
 */
async function checkMissionsSafeToDelete(supabase: Sb, organizationId: string, missionIds: string[]): Promise<Result<null>> {
  if (!missionIds.length) return { ok: true, data: null };
  const [states, values, actions, prereqRows] = await Promise.all([
    supabase.from("student_mission_states").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("mission_id", missionIds),
    supabase.from("student_mission_workspace_values").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("mission_id", missionIds),
    supabase.from("student_learning_actions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("mission_id", missionIds),
    supabase.from("learning_journey_missions").select("id,title").eq("organization_id", organizationId).in("prerequisite_mission_id", missionIds)
  ]);
  if ((states.count ?? 0) > 0) return { ok: false, error: `Có ${states.count} tiến độ học viên thật đang gắn với Nhiệm vụ trong phạm vi này — không thể xóa.` };
  if ((values.count ?? 0) > 0) return { ok: false, error: `Có dữ liệu Không gian làm việc thật của học viên trong phạm vi này — không thể xóa.` };
  if ((actions.count ?? 0) > 0) return { ok: false, error: `Có Việc cần làm thật của học viên đang gắn với Nhiệm vụ trong phạm vi này — không thể xóa.` };
  const outsidePrereq = findOutsidePrerequisiteReferences(((prereqRows.data ?? []) as { id: string; title: string }[]), missionIds)[0];
  if (outsidePrereq) return { ok: false, error: `Nhiệm vụ "${outsidePrereq.title}" ở ngoài phạm vi này đang lấy 1 Nhiệm vụ bên trong làm điều kiện mở khóa — xóa sẽ làm mất điều kiện đó.` };
  return { ok: true, data: null };
}

/** One blueprint per stage (migration 0050's unique constraint) — returns the existing one if already created. */
export async function getOrCreateBlueprint(access: AcademyAdminAccess, stageId: string, title: string): Promise<Result<{ blueprintId: string; versionId: string; created: boolean }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const existing = await supabase.from("learning_journey_blueprints").select("id").eq("organization_id", access.organizationId).eq("stage_id", stageId).maybeSingle();
  if (existing.data) {
    const latestVersion = await supabase.from("learning_journey_versions").select("id").eq("organization_id", access.organizationId).eq("blueprint_id", (existing.data as { id: string }).id).order("version_number", { ascending: false }).limit(1).maybeSingle();
    if (latestVersion.data) return { ok: true, data: { blueprintId: (existing.data as { id: string }).id, versionId: (latestVersion.data as { id: string }).id, created: false } };
  }
  const blueprintId = existing.data ? (existing.data as { id: string }).id : null;
  const { data: blueprint, error: blueprintError } = blueprintId
    ? { data: { id: blueprintId }, error: null }
    : await supabase.from("learning_journey_blueprints").insert({ organization_id: access.organizationId, stage_id: stageId, title: title || "Journey Map" }).select("id").single();
  if (blueprintError || !blueprint) return { ok: false, error: blueprintError?.message ?? "BLUEPRINT_CREATE_FAILED" };
  const { data: version, error: versionError } = await supabase.from("learning_journey_versions").insert({ organization_id: access.organizationId, blueprint_id: blueprint.id, version_number: 1, status: "draft", created_by: access.userId }).select("id").single();
  if (versionError || !version) return { ok: false, error: versionError?.message ?? "VERSION_CREATE_FAILED" };
  return { ok: true, data: { blueprintId: blueprint.id, versionId: version.id, created: true } };
}

export interface CloneGraphOptions { copyResources: boolean; copyActions: boolean; copyWorkspaceBlocks: boolean; copyPrerequisites: boolean }
const DEFAULT_CLONE_OPTIONS: CloneGraphOptions = { copyResources: true, copyActions: true, copyWorkspaceBlocks: true, copyPrerequisites: true };

/**
 * Copies the full outcome/milestone/mission graph from `sourceVersionId` into an already-created
 * `targetVersionId` (draft, on any blueprint in this org — same one for duplicateVersion, a
 * different Stage's for bulkCloneToStages). Shared so the two callers cannot drift on what "clone"
 * actually copies.
 *
 * Every cloned Mission's root_mission_id (migration 0054) inherits the source Mission's root
 * (falling back to the source's own id for a first-generation clone) — this is what lets
 * publishVersion() later recognize "this is the same Mission, just a newer version" and preserve
 * student progress across a publish, instead of Mission ids resetting identity on every clone.
 */
async function cloneGraphIntoVersion(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, org: string, actorId: string, sourceVersionId: string, targetVersionId: string, options: CloneGraphOptions = DEFAULT_CLONE_OPTIONS): Promise<Result<{ missionIdMap: Map<string, string> }>> {
  const outcomes = await loadVersionGraph(org, sourceVersionId);
  const missionIdMap = new Map<string, string>();

  for (const outcome of outcomes) {
    const { data: newOutcome, error: outcomeError } = await supabase.from("learning_journey_outcomes").insert({ organization_id: org, version_id: targetVersionId, title: outcome.title, description: outcome.description, position: outcome.position }).select("id").single();
    if (outcomeError || !newOutcome) return { ok: false, error: outcomeError?.message ?? "OUTCOME_COPY_FAILED" };
    for (const milestone of outcome.milestones) {
      const { data: newMilestone, error: milestoneError } = await supabase.from("learning_journey_milestones").insert({ organization_id: org, outcome_id: newOutcome.id, title: milestone.title, description: milestone.description, position: milestone.position }).select("id").single();
      if (milestoneError || !newMilestone) return { ok: false, error: milestoneError?.message ?? "MILESTONE_COPY_FAILED" };
      for (const mission of milestone.missions) {
        const { data: newMission, error: missionError } = await supabase.from("learning_journey_missions").insert({
          organization_id: org, milestone_id: newMilestone.id, title: mission.title, description: mission.description,
          expected_result: mission.expectedResult, estimated_days: mission.estimatedDays, completion_policy: mission.completionPolicy,
          success_criteria: mission.successCriteria, evidence_policy: mission.evidencePolicy, position: mission.position,
          root_mission_id: mission.rootMissionId ?? mission.id
          // prerequisite_mission_id set in a second pass below, once every mission in this version has a new id.
        }).select("id").single();
        if (missionError || !newMission) return { ok: false, error: missionError?.message ?? "MISSION_COPY_FAILED" };
        missionIdMap.set(mission.id, newMission.id);
        if (options.copyResources) {
          for (const binding of mission.resourceBindings) await supabase.from("learning_mission_resource_bindings").insert({ organization_id: org, mission_id: newMission.id, resource_type: binding.resourceType, resource_id: binding.resourceId, role: binding.role, position: binding.position });
          for (const binding of mission.toolBindings) await supabase.from("learning_mission_tool_bindings").insert({ organization_id: org, mission_id: newMission.id, tool_type: binding.toolType, tool_id: binding.toolId, role: binding.role, position: binding.position });
          for (const binding of mission.assignmentBindings) await supabase.from("learning_mission_assignment_bindings").insert({ organization_id: org, mission_id: newMission.id, assignment_id: binding.assignmentId, role: binding.role, position: binding.position });
        }
        if (options.copyActions) {
          for (const template of mission.actionTemplates) await supabase.from("learning_mission_action_templates").insert({ organization_id: org, mission_id: newMission.id, title: template.title, description: template.description, required: template.required, day_offset: template.dayOffset, evidence_required: template.evidenceRequired, position: template.position });
        }
      }
    }
  }

  if (options.copyPrerequisites) {
    for (const outcome of outcomes) for (const milestone of outcome.milestones) for (const mission of milestone.missions) {
      if (!mission.prerequisiteMissionId) continue;
      const newId = missionIdMap.get(mission.id);
      const newPrereqId = missionIdMap.get(mission.prerequisiteMissionId);
      if (newId && newPrereqId) await supabase.from("learning_journey_missions").update({ prerequisite_mission_id: newPrereqId }).eq("id", newId);
    }
  }

  // Mission Workspace configs (migration 0052) are keyed by (journey_version_id, mission_id) — a
  // config that isn't copied here would simply not exist for any mission in the new draft, silently
  // dropping every block Admin configured in the source version. bindingId inside each block still
  // refers to a *binding id* (learning_mission_resource_bindings.id etc.), which was NOT remapped
  // above (bindings are inserted fresh per mission, not id-preserving) — copied through as-is here
  // since fixing stale bindingIds is exactly what re-opening the mission in the Builder does, the
  // same as any other draft edit.
  if (options.copyWorkspaceBlocks) {
    const oldConfigs = await getWorkspaceConfigsForVersion(org, sourceVersionId);
    for (const [oldMissionId, config] of oldConfigs) {
      const newMissionId = missionIdMap.get(oldMissionId);
      if (!newMissionId || !config.blocks.length) continue;
      await supabase.from("learning_mission_workspace_configs").insert({
        organization_id: org, journey_version_id: targetVersionId, mission_id: newMissionId,
        schema_version: config.schemaVersion, blocks: config.blocks, created_by: actorId
      });
    }
  }

  return { ok: true, data: { missionIdMap } };
}

/**
 * "Duplicate Version": copies the full outcome/milestone/mission graph (including bindings and
 * action templates) from `sourceVersionId` into a brand new draft version on the SAME blueprint —
 * Admin edits the copy, the source (likely the currently published one) is untouched.
 */
export async function duplicateVersion(access: AcademyAdminAccess, blueprintId: string, sourceVersionId: string): Promise<Result<{ versionId: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const org = access.organizationId;

  const latest = await supabase.from("learning_journey_versions").select("version_number").eq("organization_id", org).eq("blueprint_id", blueprintId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextNumber = latest.data ? Number((latest.data as { version_number: number }).version_number) + 1 : 1;
  const { data: version, error: versionError } = await supabase.from("learning_journey_versions").insert({ organization_id: org, blueprint_id: blueprintId, version_number: nextNumber, status: "draft", created_by: access.userId }).select("id").single();
  if (versionError || !version) return { ok: false, error: versionError?.message ?? "VERSION_CREATE_FAILED" };

  const cloned = await cloneGraphIntoVersion(supabase, org, access.userId, sourceVersionId, version.id);
  if (!cloned.ok) return cloned;

  await emitJourneyEvent(org, access.userId, "journey.version_cloned", version.id, { sourceVersionId, blueprintId });
  return { ok: true, data: { versionId: version.id } };
}

/**
 * Same clone as duplicateVersion() — no separate mutation logic — used specifically by the "Tạo bản
 * nháp để chỉnh sửa" CTA the Tree Editor shows when Admin is looking at a read-only Published
 * version (v5/35-.../CLAUDE_INTEGRATION_PROMPT.md §9). Emits an extra, more specific event so
 * analytics can tell "I was blocked from editing Published and cloned my way in" apart from the
 * general "Nhân bản phiên bản này" button — both still only ever produce one journey.version_cloned.
 */
export async function cloneVersionForEditing(access: AcademyAdminAccess, blueprintId: string, sourceVersionId: string): Promise<Result<{ versionId: string }>> {
  const result = await duplicateVersion(access, blueprintId, sourceVersionId);
  if (result.ok) await emitJourneyEvent(access.organizationId, access.userId, "journey.version.cloned_for_edit", result.data.versionId, { sourceVersionId, blueprintId });
  return result;
}

/**
 * "Nhân bản sang nhiều giai đoạn" (v5/33-.../CLAUDE_INTEGRATION_PROMPT.md §10): clones one source
 * version's Mission graph into a brand NEW draft version on each target Stage's blueprint (creating
 * the blueprint first if that Stage has none yet). Every target gets its own independent draft —
 * this never touches a Published version, and never copies student progress/evidence/results
 * (those tables are never read here at all, not merely filtered out).
 */
export async function bulkCloneToStages(access: AcademyAdminAccess, input: { sourceVersionId: string; targetStageIds: string[]; options: CloneGraphOptions }): Promise<Result<{ stageId: string; versionId: string; versionNumber: number }[]>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const org = access.organizationId;
  const targets = [...new Set(input.targetStageIds)];
  if (!targets.length) return { ok: false, error: "NO_TARGET_STAGES" };

  const { data: sourceVersionRow } = await supabase.from("learning_journey_versions").select("blueprint_id").eq("organization_id", org).eq("id", input.sourceVersionId).maybeSingle();
  if (!sourceVersionRow) return { ok: false, error: "SOURCE_VERSION_NOT_FOUND" };
  const { data: sourceBlueprint } = await supabase.from("learning_journey_blueprints").select("stage_id, title").eq("organization_id", org).eq("id", (sourceVersionRow as { blueprint_id: string }).blueprint_id).maybeSingle();
  const sourceStageId = (sourceBlueprint as { stage_id: string } | null)?.stage_id;

  const results: { stageId: string; versionId: string; versionNumber: number }[] = [];
  for (const stageId of targets) {
    if (stageId === sourceStageId) continue; // never clone a Stage onto itself
    const { data: stageRow } = await supabase.from("career_stages").select("title").eq("organization_id", org).eq("id", stageId).maybeSingle();
    const blueprintResult = await getOrCreateBlueprint(access, stageId, (stageRow as { title: string } | null)?.title ?? "Bản đồ kết quả học viên");
    if (!blueprintResult.ok) return { ok: false, error: `${stageId}: ${blueprintResult.error}` };

    // getOrCreateBlueprint returns the latest existing version (draft or otherwise) when the
    // blueprint already exists — bulk clone always wants a FRESH draft, so a new version is created
    // here rather than overwriting whatever that latest version was (§10 "nếu đã có Draft, tạo
    // version tiếp theo theo rule hiện tại").
    const latest = await supabase.from("learning_journey_versions").select("version_number").eq("organization_id", org).eq("blueprint_id", blueprintResult.data.blueprintId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const nextNumber = latest.data ? Number((latest.data as { version_number: number }).version_number) + 1 : 1;
    const { data: newVersion, error: versionError } = await supabase.from("learning_journey_versions").insert({ organization_id: org, blueprint_id: blueprintResult.data.blueprintId, version_number: nextNumber, status: "draft", created_by: access.userId }).select("id").single();
    if (versionError || !newVersion) return { ok: false, error: versionError?.message ?? `${stageId}: VERSION_CREATE_FAILED` };

    const cloned = await cloneGraphIntoVersion(supabase, org, access.userId, input.sourceVersionId, newVersion.id, input.options);
    if (!cloned.ok) return { ok: false, error: `${stageId}: ${cloned.error}` };

    results.push({ stageId, versionId: newVersion.id, versionNumber: nextNumber });
  }

  if (!results.length) return { ok: false, error: "NO_VALID_TARGET_STAGES" };
  await emitJourneyEvent(org, access.userId, "journey.version_bulk_cloned", input.sourceVersionId, { targetStageIds: results.map((r) => r.stageId) });
  return { ok: true, data: results };
}

export async function createOutcome(access: AcademyAdminAccess, versionId: string, input: { title: string; description?: string }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, versionId);
  if (!draftCheck.ok) return draftCheck;
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "TITLE_REQUIRED" };
  const position = await nextPosition(supabase, "learning_journey_outcomes", "version_id", versionId);
  const { data, error } = await supabase.from("learning_journey_outcomes").insert({ organization_id: access.organizationId, version_id: versionId, title, description: input.description ?? null, position }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "OUTCOME_CREATE_FAILED" };
  await emitDomainEvent({ organizationId: access.organizationId, actorId: access.userId, resourceType: "learning_journey_outcomes", resourceId: data.id, eventName: "journey.outcome.created", payload: { versionId } }).catch(() => {});
  return { ok: true, data: { id: data.id } };
}

export async function updateOutcome(access: AcademyAdminAccess, outcomeId: string, input: { title?: string; description?: string | null; position?: number }): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const resolved = await resolveOutcomeVersion(supabase, access.organizationId, outcomeId);
  if (!resolved) return { ok: false, error: "OUTCOME_NOT_FOUND" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, resolved.versionId);
  if (!draftCheck.ok) return draftCheck;
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) { const title = input.title.trim(); if (!title) return { ok: false, error: "TITLE_REQUIRED" }; patch.title = title; }
  if (input.description !== undefined) patch.description = input.description;
  if (input.position !== undefined) patch.position = input.position;
  if (Object.keys(patch).length === 0) return { ok: true, data: null };
  const { error } = await supabase.from("learning_journey_outcomes").update(patch).eq("organization_id", access.organizationId).eq("id", outcomeId);
  if (error) return { ok: false, error: error.message };
  await emitDomainEvent({ organizationId: access.organizationId, actorId: access.userId, resourceType: "learning_journey_outcomes", resourceId: outcomeId, eventName: "journey.outcome.updated", payload: { versionId: resolved.versionId } }).catch(() => {});
  return { ok: true, data: null };
}

/**
 * Xóa Kết quả (draft only, §8): checkMissionsSafeToDelete first, then walk the same
 * mission -> milestone -> outcome delete order deleteDraftVersion() already established rather than
 * rely on FK cascade alone.
 */
export async function deleteOutcome(access: AcademyAdminAccess, outcomeId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const resolved = await resolveOutcomeVersion(supabase, access.organizationId, outcomeId);
  if (!resolved) return { ok: false, error: "OUTCOME_NOT_FOUND" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, resolved.versionId);
  if (!draftCheck.ok) return draftCheck;

  const { data: milestoneRows } = await supabase.from("learning_journey_milestones").select("id").eq("organization_id", access.organizationId).eq("outcome_id", outcomeId);
  const milestoneIds = ((milestoneRows ?? []) as { id: string }[]).map((m) => m.id);
  const { data: missionRows } = milestoneIds.length ? await supabase.from("learning_journey_missions").select("id").eq("organization_id", access.organizationId).in("milestone_id", milestoneIds) : { data: [] };
  const missionIds = ((missionRows ?? []) as { id: string }[]).map((m) => m.id);

  const safe = await checkMissionsSafeToDelete(supabase, access.organizationId, missionIds);
  if (!safe.ok) return safe;

  if (missionIds.length) {
    await supabase.from("learning_mission_workspace_configs").delete().eq("organization_id", access.organizationId).in("mission_id", missionIds);
    await supabase.from("learning_journey_missions").delete().eq("organization_id", access.organizationId).in("milestone_id", milestoneIds);
  }
  if (milestoneIds.length) await supabase.from("learning_journey_milestones").delete().eq("organization_id", access.organizationId).eq("outcome_id", outcomeId);
  const { error } = await supabase.from("learning_journey_outcomes").delete().eq("organization_id", access.organizationId).eq("id", outcomeId);
  if (error) return { ok: false, error: error.message };
  await emitDomainEvent({ organizationId: access.organizationId, actorId: access.userId, resourceType: "learning_journey_outcomes", resourceId: outcomeId, eventName: "journey.outcome.deleted", payload: { versionId: resolved.versionId } }).catch(() => {});
  return { ok: true, data: null };
}

export async function createMilestone(access: AcademyAdminAccess, outcomeId: string, input: { title: string; description?: string }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const resolved = await resolveOutcomeVersion(supabase, access.organizationId, outcomeId);
  if (!resolved) return { ok: false, error: "OUTCOME_NOT_FOUND" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, resolved.versionId);
  if (!draftCheck.ok) return draftCheck;
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "TITLE_REQUIRED" };
  const position = await nextPosition(supabase, "learning_journey_milestones", "outcome_id", outcomeId);
  const { data, error } = await supabase.from("learning_journey_milestones").insert({ organization_id: access.organizationId, outcome_id: outcomeId, title, description: input.description ?? null, position }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "MILESTONE_CREATE_FAILED" };
  await emitDomainEvent({ organizationId: access.organizationId, actorId: access.userId, resourceType: "learning_journey_milestones", resourceId: data.id, eventName: "journey.milestone.created", payload: { outcomeId } }).catch(() => {});
  return { ok: true, data: { id: data.id } };
}

export async function updateMilestone(access: AcademyAdminAccess, milestoneId: string, input: { title?: string; description?: string | null; position?: number }): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const resolved = await resolveMilestoneVersion(supabase, access.organizationId, milestoneId);
  if (!resolved) return { ok: false, error: "MILESTONE_NOT_FOUND" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, resolved.versionId);
  if (!draftCheck.ok) return draftCheck;
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) { const title = input.title.trim(); if (!title) return { ok: false, error: "TITLE_REQUIRED" }; patch.title = title; }
  if (input.description !== undefined) patch.description = input.description;
  if (input.position !== undefined) patch.position = input.position;
  if (Object.keys(patch).length === 0) return { ok: true, data: null };
  const { error } = await supabase.from("learning_journey_milestones").update(patch).eq("organization_id", access.organizationId).eq("id", milestoneId);
  if (error) return { ok: false, error: error.message };
  await emitDomainEvent({ organizationId: access.organizationId, actorId: access.userId, resourceType: "learning_journey_milestones", resourceId: milestoneId, eventName: "journey.milestone.updated", payload: { versionId: resolved.versionId } }).catch(() => {});
  return { ok: true, data: null };
}

/** Xóa Chặng (draft only, §8) — same safe-delete check + delete order as deleteOutcome, one level shallower. */
export async function deleteMilestone(access: AcademyAdminAccess, milestoneId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const resolved = await resolveMilestoneVersion(supabase, access.organizationId, milestoneId);
  if (!resolved) return { ok: false, error: "MILESTONE_NOT_FOUND" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, resolved.versionId);
  if (!draftCheck.ok) return draftCheck;

  const { data: missionRows } = await supabase.from("learning_journey_missions").select("id").eq("organization_id", access.organizationId).eq("milestone_id", milestoneId);
  const missionIds = ((missionRows ?? []) as { id: string }[]).map((m) => m.id);

  const safe = await checkMissionsSafeToDelete(supabase, access.organizationId, missionIds);
  if (!safe.ok) return safe;

  if (missionIds.length) {
    await supabase.from("learning_mission_workspace_configs").delete().eq("organization_id", access.organizationId).in("mission_id", missionIds);
    await supabase.from("learning_journey_missions").delete().eq("organization_id", access.organizationId).eq("milestone_id", milestoneId);
  }
  const { error } = await supabase.from("learning_journey_milestones").delete().eq("organization_id", access.organizationId).eq("id", milestoneId);
  if (error) return { ok: false, error: error.message };
  await emitDomainEvent({ organizationId: access.organizationId, actorId: access.userId, resourceType: "learning_journey_milestones", resourceId: milestoneId, eventName: "journey.milestone.deleted", payload: { versionId: resolved.versionId, outcomeId: resolved.outcomeId } }).catch(() => {});
  return { ok: true, data: null };
}

/**
 * Reorders a sibling Outcome/Milestone/Mission by swapping `position` with its immediate neighbour —
 * same shape as the existing Stage reorder (app/academy-admin/stages/page.tsx's moveStage), same-
 * parent only (§10 — cross-parent drag needs a prerequisite-remap audit this V1 does not do).
 */
export async function reorderTreeNode(access: AcademyAdminAccess, nodeType: "outcome" | "milestone" | "mission", nodeId: string, direction: -1 | 1): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const table = nodeType === "outcome" ? "learning_journey_outcomes" : nodeType === "milestone" ? "learning_journey_milestones" : "learning_journey_missions";
  const parentColumn = nodeType === "outcome" ? "version_id" : nodeType === "milestone" ? "outcome_id" : "milestone_id";

  const { data: nodeRow } = await supabase.from(table).select(`id,position,${parentColumn}`).eq("organization_id", access.organizationId).eq("id", nodeId).maybeSingle();
  if (!nodeRow) return { ok: false, error: "NODE_NOT_FOUND" };
  const parentId = (nodeRow as Record<string, unknown>)[parentColumn] as string;

  const versionId = nodeType === "outcome" ? parentId
    : nodeType === "milestone" ? (await resolveOutcomeVersion(supabase, access.organizationId, parentId))?.versionId ?? null
    : (await resolveMilestoneVersion(supabase, access.organizationId, parentId))?.versionId ?? null;
  if (!versionId) return { ok: false, error: "VERSION_NOT_FOUND" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, versionId);
  if (!draftCheck.ok) return draftCheck;

  const { data: siblingRows } = await supabase.from(table).select("id,position").eq("organization_id", access.organizationId).eq(parentColumn, parentId);
  const swap = computeSiblingSwap(((siblingRows ?? []) as { id: string; position: number }[]), nodeId, direction);
  if (!swap) return { ok: false, error: "CANNOT_MOVE" };
  const { current, swapWith } = swap;

  const { error: err1 } = await supabase.from(table).update({ position: swapWith.position }).eq("organization_id", access.organizationId).eq("id", current.id);
  if (err1) return { ok: false, error: err1.message };
  const { error: err2 } = await supabase.from(table).update({ position: current.position }).eq("organization_id", access.organizationId).eq("id", swapWith.id);
  if (err2) return { ok: false, error: err2.message };

  await emitDomainEvent({ organizationId: access.organizationId, actorId: access.userId, resourceType: table, resourceId: nodeId, eventName: "journey.tree.reordered", payload: { nodeType, parentId, direction } }).catch(() => {});
  return { ok: true, data: null };
}

export async function createMission(access: AcademyAdminAccess, milestoneId: string, input: MissionInput): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const resolved = await resolveMilestoneVersion(supabase, access.organizationId, milestoneId);
  if (!resolved) return { ok: false, error: "MILESTONE_NOT_FOUND" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, resolved.versionId);
  if (!draftCheck.ok) return draftCheck;
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "TITLE_REQUIRED" };
  const position = await nextPosition(supabase, "learning_journey_missions", "milestone_id", milestoneId);
  const { data, error } = await supabase.from("learning_journey_missions").insert({
    organization_id: access.organizationId, milestone_id: milestoneId, title,
    description: input.description ?? null, expected_result: input.expectedResult ?? "",
    estimated_days: input.estimatedDays ?? null, prerequisite_mission_id: input.prerequisiteMissionId ?? null,
    completion_policy: input.completionPolicy ?? "evidence_required",
    success_criteria: input.successCriteria ?? [], evidence_policy: input.evidencePolicy ?? {}, position
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "MISSION_CREATE_FAILED" };
  // A freshly created Mission is its own identity root (migration 0054) — cloning inherits from
  // here, never overwrites it, so a mission's root always points at where the lineage began.
  await supabase.from("learning_journey_missions").update({ root_mission_id: data.id }).eq("id", data.id);
  await emitDomainEvent({ organizationId: access.organizationId, actorId: access.userId, resourceType: "learning_journey_missions", resourceId: data.id, eventName: "journey.mission.created", payload: { milestoneId } }).catch(() => {});
  return { ok: true, data: { id: data.id } };
}

export async function updateMission(access: AcademyAdminAccess, missionId: string, input: Partial<MissionInput>): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const resolved = await resolveMissionVersion(supabase, access.organizationId, missionId);
  if (!resolved) return { ok: false, error: "MISSION_NOT_FOUND" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, resolved.versionId);
  if (!draftCheck.ok) return draftCheck;
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.expectedResult !== undefined) patch.expected_result = input.expectedResult;
  if (input.estimatedDays !== undefined) patch.estimated_days = input.estimatedDays;
  if (input.prerequisiteMissionId !== undefined) patch.prerequisite_mission_id = input.prerequisiteMissionId;
  if (input.completionPolicy !== undefined) patch.completion_policy = input.completionPolicy;
  if (input.successCriteria !== undefined) patch.success_criteria = input.successCriteria;
  if (input.evidencePolicy !== undefined) patch.evidence_policy = input.evidencePolicy;
  if (input.position !== undefined) patch.position = input.position;
  if (Object.keys(patch).length === 0) return { ok: true, data: null };
  const { error } = await supabase.from("learning_journey_missions").update(patch).eq("organization_id", access.organizationId).eq("id", missionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/**
 * Deliberate exception to the "structural writes require Draft" rule every other function in this
 * file enforces via requireDraftVersion() (§ journey-tree-editor-v1 security fix): attaching/removing
 * which documents/tools/assignments show up in a Mission's "Học liệu" list is content curation, not a
 * structural change — it never touches Mission identity, completion_policy, prerequisite chain, or
 * student progress rows, so publishVersion()'s root_mission_id remap has nothing to do here either
 * way. Deliberately allowed on the currently-Published version too (2026-08-12 request: Admin needs
 * to add a reference document for students same-day, without a clone/preview/publish cycle for a
 * pure content addition) — the app/academy-admin/journey/page.tsx UI exposes this via a separate
 * `canEditBindings` flag (true regardless of Draft/Published) distinct from `isDraft` (still gates
 * every structural field). Do not add requireDraftVersion() here — that would silently break the
 * "edit Học liệu live" feature this comment exists to protect.
 */
export async function attachMissionBinding(
  access: AcademyAdminAccess, missionId: string,
  kind: "resource" | "tool" | "assignment",
  input: { resourceType?: string; resourceId?: string; toolType?: string; toolId?: string; assignmentId?: string; role?: MissionBindingRole }
): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const role = input.role ?? "required";
  if (kind === "resource") {
    if (!input.resourceType || !input.resourceId) return { ok: false, error: "RESOURCE_REQUIRED" };
    const position = await nextPosition(supabase, "learning_mission_resource_bindings", "mission_id", missionId);
    const { data, error } = await supabase.from("learning_mission_resource_bindings").insert({ organization_id: access.organizationId, mission_id: missionId, resource_type: input.resourceType, resource_id: input.resourceId, role, position }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "BINDING_CREATE_FAILED" };
    return { ok: true, data: { id: data.id } };
  }
  if (kind === "tool") {
    if (!input.toolType || !input.toolId) return { ok: false, error: "TOOL_REQUIRED" };
    const position = await nextPosition(supabase, "learning_mission_tool_bindings", "mission_id", missionId);
    const { data, error } = await supabase.from("learning_mission_tool_bindings").insert({ organization_id: access.organizationId, mission_id: missionId, tool_type: input.toolType, tool_id: input.toolId, role, position }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "BINDING_CREATE_FAILED" };
    return { ok: true, data: { id: data.id } };
  }
  if (!input.assignmentId) return { ok: false, error: "ASSIGNMENT_REQUIRED" };
  const position = await nextPosition(supabase, "learning_mission_assignment_bindings", "mission_id", missionId);
  const { data, error } = await supabase.from("learning_mission_assignment_bindings").insert({ organization_id: access.organizationId, mission_id: missionId, assignment_id: input.assignmentId, role, position }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "BINDING_CREATE_FAILED" };
  return { ok: true, data: { id: data.id } };
}

/** Same intentional Draft-status exception as attachMissionBinding() above — content curation, allowed on Published. */
export async function removeMissionBinding(access: AcademyAdminAccess, kind: "resource" | "tool" | "assignment", bindingId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const table = kind === "resource" ? "learning_mission_resource_bindings" : kind === "tool" ? "learning_mission_tool_bindings" : "learning_mission_assignment_bindings";
  const { error } = await supabase.from(table).delete().eq("organization_id", access.organizationId).eq("id", bindingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function createActionTemplate(access: AcademyAdminAccess, missionId: string, input: { title: string; description?: string; required?: boolean; dayOffset?: number | null; evidenceRequired?: boolean }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "TITLE_REQUIRED" };
  const position = await nextPosition(supabase, "learning_mission_action_templates", "mission_id", missionId);
  const { data, error } = await supabase.from("learning_mission_action_templates").insert({
    organization_id: access.organizationId, mission_id: missionId, title, description: input.description ?? null,
    required: input.required ?? true, day_offset: input.dayOffset ?? null, evidence_required: input.evidenceRequired ?? false, position
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "ACTION_TEMPLATE_CREATE_FAILED" };
  return { ok: true, data: { id: data.id } };
}

/**
 * Blockers per docs/learn-outcome-os's ADMIN_JOURNEY_MAP_BUILDER.md — checked against the actual
 * graph, not simulated. Cross-org binding and broken resource/tool/assignment references are
 * checked by existence, scoped to this organization; a binding whose target belongs to another org
 * (or doesn't exist at all) fails the same check, since a cross-org row is indistinguishable from a
 * missing one once queried with an organization_id filter.
 */
export async function preflightVersion(organizationId: string, versionId: string): Promise<PreflightResult> {
  const outcomes = await loadVersionGraph(organizationId, versionId);
  const findings: PreflightFinding[] = [];
  const add = (severity: PreflightFinding["severity"], category: PreflightFinding["category"], message: string, mission?: { id: string; title: string }) =>
    findings.push({ severity, category, missionId: mission?.id ?? null, missionTitle: mission?.title ?? null, message });

  if (outcomes.length === 0) add("blocker", "structure", "0 outcomes");
  const missions = outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions));
  if (missions.length === 0) add("blocker", "structure", "0 missions");

  const missionIds = new Set(missions.map((m) => m.id));
  for (const mission of missions) {
    if (!mission.expectedResult?.trim()) add("blocker", "structure", "Thiếu expected result", mission);
    if (mission.completionPolicy === "evidence_required" && !mission.evidencePolicy?.type) add("blocker", "structure", "Yêu cầu evidence nhưng chưa chọn evidence type", mission);
    if (mission.prerequisiteMissionId && !missionIds.has(mission.prerequisiteMissionId)) add("blocker", "broken_reference", "Prerequisite không tồn tại trong version này", mission);
    if (!mission.estimatedDays) add("warning", "missing_duration", "Chưa có estimated days", mission);
    if (!mission.resourceBindings.length && !mission.toolBindings.length) add("warning", "missing_binding", "Chưa có resource/tool gợi ý", mission);
    if (!mission.actionTemplates.length) add("warning", "other", "Chưa có action template", mission);
    // Success Criteria was a warning through Release B/29/30 — v5/32-.../CLAUDE_H2OBOOK_LEARN_OUTCOME_OS_V4.md
    // §10 makes it a blocker ("production Mission should not publish with empty Success Criteria").
    // The already-published v1 is unaffected (immutable); this only gates the NEXT publish.
    if (!mission.successCriteria.length) add("blocker", "missing_kpi", "Thiếu Success Criteria", mission);
    // "no teacher rubric when teacher verification requires it" (§10, warning). This schema has no
    // rubric field on a Mission directly — a rubric only exists via assignment_definitions'
    // rubric_criteria (migration 0026/0036), reached through an assignment binding. No assignment
    // binding means no way for a teacher to grade against a rubric when they review this Mission.
    if (mission.completionPolicy === "teacher_verified" && !mission.assignmentBindings.length) add("warning", "other", "Yêu cầu giáo viên xác nhận nhưng chưa gắn assignment/rubric", mission);
  }

  // Circular prerequisite: walk each mission's prerequisite chain; a cycle means walking never
  // reaches a mission with no prerequisite before revisiting one already on the current path.
  const prereqById = new Map(missions.map((m) => [m.id, m.prerequisiteMissionId]));
  for (const mission of missions) {
    const seen = new Set<string>();
    let cursor: string | null = mission.id;
    while (cursor) {
      if (seen.has(cursor)) { add("blocker", "circular", "Circular prerequisite phát hiện tại mission này", mission); break; }
      seen.add(cursor);
      cursor = prereqById.get(cursor) ?? null;
    }
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    const missionByBindingResource = new Map<string, { id: string; title: string }>();
    for (const mission of missions) for (const b of mission.resourceBindings) missionByBindingResource.set(b.id, mission);
    const missionByAssignmentBinding = new Map<string, { id: string; title: string }>();
    for (const mission of missions) for (const b of mission.assignmentBindings) missionByAssignmentBinding.set(b.id, mission);

    const resourceBindings = missions.flatMap((m) => m.resourceBindings);
    const assignmentBindings = missions.flatMap((m) => m.assignmentBindings);
    // resource_type names which real table resource_id points into — a mission resource binding is
    // not always a career_stage_resources placement row; when it names the stage-agnostic content
    // directly (resource_type='document') resource_id is a curriculum_documents id instead. Checked
    // against whichever table the binding's own resource_type says, not one fixed table.
    const RESOURCE_TABLE_BY_TYPE: Record<string, string> = { career_stage_resource: "career_stage_resources", document: "curriculum_documents" };
    const bindingsByType = new Map<string, typeof resourceBindings>();
    for (const binding of resourceBindings) {
      const list = bindingsByType.get(binding.resourceType) ?? [];
      list.push(binding);
      bindingsByType.set(binding.resourceType, list);
    }
    for (const [resourceType, bindings] of bindingsByType) {
      const table = RESOURCE_TABLE_BY_TYPE[resourceType];
      const ids = [...new Set(bindings.map((b) => b.resourceId))];
      if (!table) { add("warning", "other", `Resource binding có resource_type chưa hỗ trợ kiểm tra tồn tại: ${resourceType}`); continue; }
      const { data } = await admin.from(table).select("id").eq("organization_id", organizationId).in("id", ids);
      const found = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
      for (const binding of bindings) if (!found.has(binding.resourceId)) add("blocker", "broken_reference", `Resource binding (${resourceType}) trỏ tới id không tồn tại: ${binding.resourceId}`, missionByBindingResource.get(binding.id));
    }
    if (assignmentBindings.length) {
      const ids = [...new Set(assignmentBindings.map((b) => b.assignmentId))];
      const { data } = await admin.from("assignment_definitions").select("id").eq("organization_id", organizationId).in("id", ids);
      const found = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
      for (const binding of assignmentBindings) if (!found.has(binding.assignmentId)) add("blocker", "broken_reference", `Assignment binding trỏ tới id không tồn tại: ${binding.assignmentId}`, missionByAssignmentBinding.get(binding.id));
    }
  }

  // Mission Workspace checks (docs/30 §17): duplicate block ids and a reference block (resource/
  // tool/assignment) with no bindingId are blockers — everything else about a missing/empty
  // workspace is a warning, not a blocker, since a Mission with only "Hiểu nhiệm vụ" content is
  // still a valid, publishable Mission in Release 1 (the "Làm việc" tab renderer is Release 2).
  const workspaceConfigs = await getWorkspaceConfigsForVersion(organizationId, versionId);
  for (const mission of missions) {
    // "evidence-required Mission has no evidence path" / "result-required Mission has no valid
    // result path" (§17). In this schema evidence is submitted against the mission state itself
    // (migration 0051), so the real failure mode is a mission that demands evidence or teacher
    // review while telling the student nothing about what to submit — no evidence/result block and
    // no action marked evidence_required.
    const needsEvidence = mission.completionPolicy === "evidence_required" || mission.completionPolicy === "teacher_verified";
    const config = workspaceConfigs.get(mission.id);
    const blocks = config?.blocks ?? [];
    if (needsEvidence && !blocks.some((b) => ["evidence", "file", "image", "video", "link", "result_summary", "result_card"].includes(b.type)) && !mission.actionTemplates.some((t) => t.evidenceRequired)) {
      add("warning", "other", `Mission cần Evidence (${mission.completionPolicy}) nhưng không có block bằng chứng/kết quả nào và không action nào đánh dấu cần evidence`, mission);
    }

    if (!blocks.length) { add("warning", "other", "Mission chưa có Workspace config", mission); continue; }
    const seenBlockIds = new Set<string>();
    for (const block of blocks) {
      if (seenBlockIds.has(block.id)) add("blocker", "structure", `Workspace có block id trùng lặp: ${block.id}`, mission);
      seenBlockIds.add(block.id);
      // "published definition contains unsupported block type" (§17) — a config written by an older
      // or hand-edited payload could carry a type this build cannot render, which would silently
      // show the student nothing.
      if (!MISSION_BLOCK_TYPES.has(block.type)) add("blocker", "structure", `Block "${block.label}" dùng loại không hỗ trợ: ${block.type}`, mission);
      if (["resource", "tool", "assignment"].includes(block.type)) {
        if (!block.bindingId) add("blocker", "missing_binding", `Block "${block.label}" (${block.type}) chưa gắn canonical binding`, mission);
        // "cross-org reference" (§17): a bindingId must point at a binding of THIS mission — the
        // Admin picker only offers those, but a hand-written payload could name another mission's
        // (or another org's) binding id, which would resolve to nothing or leak a title.
        else {
          const owned = mission.resourceBindings.some((b) => b.id === block.bindingId)
            || mission.toolBindings.some((b) => b.id === block.bindingId)
            || mission.assignmentBindings.some((b) => b.id === block.bindingId);
          if (!owned) add("blocker", "broken_reference", `Block "${block.label}" trỏ tới binding không thuộc Mission này: ${block.bindingId}`, mission);
        }
      }
      // "required block has invalid config" (§17): a required block the student cannot actually
      // answer — a choice/list block with no options configured.
      if (block.required && ITEMS_REQUIRED_TYPES.has(block.type) && !((block.options?.items as unknown[] | undefined)?.length)) {
        add("blocker", "structure", `Block bắt buộc "${block.label}" (${block.type}) chưa cấu hình danh sách lựa chọn`, mission);
      }
    }
  }

  const blockers = findings.filter((f) => f.severity === "blocker").map((f) => f.missionTitle ? `Mission "${f.missionTitle}": ${f.message}` : f.message);
  const warnings = findings.filter((f) => f.severity === "warning").map((f) => f.missionTitle ? `Mission "${f.missionTitle}": ${f.message}` : f.message);
  return { ok: blockers.length === 0, blockers, warnings, findings };
}

/**
 * Repoints every student_mission_states row still pinned to `oldVersionId` onto its equivalent
 * Mission in `newVersionId` — matched by root_mission_id (migration 0054), not by title or
 * position, since those can legitimately change between versions. This is what makes publish
 * "Safe" per §13: a row whose Mission has no equivalent in the new version (removed Mission) is
 * left exactly as-is — never deleted, never blanked — so it stays as historical record; it simply
 * stops appearing under the now-current version. Evidence/verified_at/state all live as columns on
 * this same row (migration 0051), so repointing mission_id + blueprint_version_id carries them
 * along untouched.
 */
async function repointStudentProgress(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, org: string, oldVersionId: string, newVersionId: string): Promise<void> {
  const [oldGraph, newGraph] = await Promise.all([loadVersionGraph(org, oldVersionId), loadVersionGraph(org, newVersionId)]);

  const oldMissionRoot = new Map<string, string>();
  for (const outcome of oldGraph) for (const milestone of outcome.milestones) for (const mission of milestone.missions) oldMissionRoot.set(mission.id, mission.rootMissionId ?? mission.id);

  const newMissionByRoot = new Map<string, string>();
  for (const outcome of newGraph) for (const milestone of outcome.milestones) for (const mission of milestone.missions) newMissionByRoot.set(mission.rootMissionId ?? mission.id, mission.id);

  const { data: states } = await supabase.from("student_mission_states").select("id, mission_id").eq("organization_id", org).eq("blueprint_version_id", oldVersionId);
  for (const state of (states ?? []) as { id: string; mission_id: string }[]) {
    const root = oldMissionRoot.get(state.mission_id);
    const newMissionId = root ? newMissionByRoot.get(root) : undefined;
    if (!newMissionId) continue; // Mission removed in the new version — row stays pinned to the old (archived) version as history.
    await supabase.from("student_mission_states").update({ blueprint_version_id: newVersionId, mission_id: newMissionId }).eq("id", state.id);
  }
}

/**
 * Publishes a draft version: repoints real student progress off the outgoing published version onto
 * this one (see repointStudentProgress), archives the outgoing version, and points
 * current_published_version_id at this one. Not wrapped in a single database transaction —
 * supabase-js issues each statement as its own request — so a failure between steps could in theory
 * leave the blueprint briefly without a current published version. Accepted for Release A; worth a
 * real transaction (an RPC) before a higher-stakes cutover depends on atomicity here.
 */
export async function publishVersion(access: AcademyAdminAccess, blueprintId: string, versionId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, versionId);
  if (!draftCheck.ok) return draftCheck;

  const preflight = await preflightVersion(access.organizationId, versionId);
  if (!preflight.ok) return { ok: false, error: `PREFLIGHT_FAILED: ${preflight.blockers.join("; ")}` };

  const { data: outgoing } = await supabase.from("learning_journey_versions").select("id").eq("organization_id", access.organizationId).eq("blueprint_id", blueprintId).eq("status", "published").maybeSingle();
  const outgoingVersionId = (outgoing as { id: string } | null)?.id ?? null;

  if (outgoingVersionId) await repointStudentProgress(supabase, access.organizationId, outgoingVersionId, versionId);

  const { error: archiveError } = await supabase.from("learning_journey_versions").update({ status: "archived" }).eq("organization_id", access.organizationId).eq("blueprint_id", blueprintId).eq("status", "published");
  if (archiveError) return { ok: false, error: archiveError.message };

  const publishedAt = new Date().toISOString();
  const { error: publishError } = await supabase.from("learning_journey_versions").update({ status: "published", published_at: publishedAt }).eq("organization_id", access.organizationId).eq("id", versionId);
  if (publishError) return { ok: false, error: publishError.message };

  const { error: pointerError } = await supabase.from("learning_journey_blueprints").update({ current_published_version_id: versionId, updated_at: publishedAt }).eq("organization_id", access.organizationId).eq("id", blueprintId);
  if (pointerError) return { ok: false, error: pointerError.message };

  await emitJourneyEvent(access.organizationId, access.userId, "journey.version_published", versionId, { blueprintId, outgoingVersionId });
  return { ok: true, data: null };
}

export async function archiveVersion(access: AcademyAdminAccess, versionId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("learning_journey_versions").update({ status: "archived" }).eq("organization_id", access.organizationId).eq("id", versionId);
  if (error) return { ok: false, error: error.message };
  await emitJourneyEvent(access.organizationId, access.userId, "journey.version_archived", versionId, {});
  return { ok: true, data: null };
}

/**
 * "Xóa bản nháp" (§11): only ever a Draft — Published/current is never hard-deleted (Archive is the
 * only removal path for those, handled by archiveVersion above). Re-checks status at delete time
 * (not just trusting the caller's UI state) and blocks with the exact reason when the draft is
 * referenced, per the source package's explicit rule.
 */
export async function deleteDraftVersion(access: AcademyAdminAccess, versionId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const org = access.organizationId;

  const { data: version } = await supabase.from("learning_journey_versions").select("id, status, blueprint_id").eq("organization_id", org).eq("id", versionId).maybeSingle();
  if (!version) return { ok: false, error: "VERSION_NOT_FOUND" };
  const row = version as { id: string; status: string; blueprint_id: string };
  if (row.status !== "draft") return { ok: false, error: "VERSION_NOT_DRAFT" };

  const { data: blueprint } = await supabase.from("learning_journey_blueprints").select("current_published_version_id").eq("organization_id", org).eq("id", row.blueprint_id).maybeSingle();
  if ((blueprint as { current_published_version_id: string | null } | null)?.current_published_version_id === versionId) return { ok: false, error: "VERSION_IS_CURRENT_PUBLISHED" };

  const { count } = await supabase.from("student_mission_states").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("blueprint_version_id", versionId);
  if (count && count > 0) return { ok: false, error: "VERSION_HAS_STUDENT_PROGRESS" };

  // Delete order follows the same graph shape everything else here uses: outcomes -> milestones ->
  // missions -> (bindings/action templates cascade via on delete cascade from migration 0050) ->
  // workspace configs (migration 0052, not FK-cascaded from missions since it's keyed by
  // journey_version_id + mission_id, so it needs its own explicit delete).
  const { data: outcomeRows } = await supabase.from("learning_journey_outcomes").select("id").eq("organization_id", org).eq("version_id", versionId);
  const outcomeIds = (outcomeRows ?? []).map((o) => (o as { id: string }).id);
  if (outcomeIds.length) {
    const { data: milestoneRows } = await supabase.from("learning_journey_milestones").select("id").eq("organization_id", org).in("outcome_id", outcomeIds);
    const milestoneIds = (milestoneRows ?? []).map((m) => (m as { id: string }).id);
    if (milestoneIds.length) await supabase.from("learning_journey_missions").delete().eq("organization_id", org).in("milestone_id", milestoneIds);
    await supabase.from("learning_journey_milestones").delete().eq("organization_id", org).in("outcome_id", outcomeIds);
  }
  await supabase.from("learning_journey_outcomes").delete().eq("organization_id", org).eq("version_id", versionId);
  await supabase.from("learning_mission_workspace_configs").delete().eq("organization_id", org).eq("journey_version_id", versionId);
  const { error: deleteError } = await supabase.from("learning_journey_versions").delete().eq("organization_id", org).eq("id", versionId);
  if (deleteError) return { ok: false, error: deleteError.message };

  await emitJourneyEvent(org, access.userId, "journey.version_deleted", versionId, { blueprintId: row.blueprint_id });
  return { ok: true, data: null };
}
