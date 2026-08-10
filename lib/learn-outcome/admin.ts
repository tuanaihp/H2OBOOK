import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AcademyAdminAccess } from "@/lib/academy-admin/types";
import { loadVersionGraph } from "./service";
import type { MissionBindingRole, MissionInput, PreflightFinding, PreflightResult } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

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

/**
 * "Duplicate Version": copies the full outcome/milestone/mission graph (including bindings and
 * action templates) from `sourceVersionId` into a brand new draft version — Admin edits the copy,
 * the source (likely the currently published one) is untouched. Mission ids change on copy, so
 * prerequisite_mission_id links are remapped through an old-id -> new-id map built during the copy
 * rather than reused verbatim.
 */
export async function duplicateVersion(access: AcademyAdminAccess, blueprintId: string, sourceVersionId: string): Promise<Result<{ versionId: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const org = access.organizationId;

  const latest = await supabase.from("learning_journey_versions").select("version_number").eq("organization_id", org).eq("blueprint_id", blueprintId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextNumber = latest.data ? Number((latest.data as { version_number: number }).version_number) + 1 : 1;
  const { data: version, error: versionError } = await supabase.from("learning_journey_versions").insert({ organization_id: org, blueprint_id: blueprintId, version_number: nextNumber, status: "draft", created_by: access.userId }).select("id").single();
  if (versionError || !version) return { ok: false, error: versionError?.message ?? "VERSION_CREATE_FAILED" };

  const outcomes = await loadVersionGraph(org, sourceVersionId);
  const missionIdMap = new Map<string, string>();

  for (const outcome of outcomes) {
    const { data: newOutcome, error: outcomeError } = await supabase.from("learning_journey_outcomes").insert({ organization_id: org, version_id: version.id, title: outcome.title, description: outcome.description, position: outcome.position }).select("id").single();
    if (outcomeError || !newOutcome) return { ok: false, error: outcomeError?.message ?? "OUTCOME_COPY_FAILED" };
    for (const milestone of outcome.milestones) {
      const { data: newMilestone, error: milestoneError } = await supabase.from("learning_journey_milestones").insert({ organization_id: org, outcome_id: newOutcome.id, title: milestone.title, description: milestone.description, position: milestone.position }).select("id").single();
      if (milestoneError || !newMilestone) return { ok: false, error: milestoneError?.message ?? "MILESTONE_COPY_FAILED" };
      for (const mission of milestone.missions) {
        const { data: newMission, error: missionError } = await supabase.from("learning_journey_missions").insert({
          organization_id: org, milestone_id: newMilestone.id, title: mission.title, description: mission.description,
          expected_result: mission.expectedResult, estimated_days: mission.estimatedDays, completion_policy: mission.completionPolicy,
          success_criteria: mission.successCriteria, evidence_policy: mission.evidencePolicy, position: mission.position
          // prerequisite_mission_id set in a second pass below, once every mission in this version has a new id.
        }).select("id").single();
        if (missionError || !newMission) return { ok: false, error: missionError?.message ?? "MISSION_COPY_FAILED" };
        missionIdMap.set(mission.id, newMission.id);
        for (const binding of mission.resourceBindings) await supabase.from("learning_mission_resource_bindings").insert({ organization_id: org, mission_id: newMission.id, resource_type: binding.resourceType, resource_id: binding.resourceId, role: binding.role, position: binding.position });
        for (const binding of mission.toolBindings) await supabase.from("learning_mission_tool_bindings").insert({ organization_id: org, mission_id: newMission.id, tool_type: binding.toolType, tool_id: binding.toolId, role: binding.role, position: binding.position });
        for (const binding of mission.assignmentBindings) await supabase.from("learning_mission_assignment_bindings").insert({ organization_id: org, mission_id: newMission.id, assignment_id: binding.assignmentId, role: binding.role, position: binding.position });
        for (const template of mission.actionTemplates) await supabase.from("learning_mission_action_templates").insert({ organization_id: org, mission_id: newMission.id, title: template.title, description: template.description, required: template.required, day_offset: template.dayOffset, evidence_required: template.evidenceRequired, position: template.position });
      }
    }
  }

  for (const outcome of outcomes) for (const milestone of outcome.milestones) for (const mission of milestone.missions) {
    if (!mission.prerequisiteMissionId) continue;
    const newId = missionIdMap.get(mission.id);
    const newPrereqId = missionIdMap.get(mission.prerequisiteMissionId);
    if (newId && newPrereqId) await supabase.from("learning_journey_missions").update({ prerequisite_mission_id: newPrereqId }).eq("id", newId);
  }

  return { ok: true, data: { versionId: version.id } };
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
  return { ok: true, data: { id: data.id } };
}

export async function createMilestone(access: AcademyAdminAccess, outcomeId: string, input: { title: string; description?: string }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "TITLE_REQUIRED" };
  const position = await nextPosition(supabase, "learning_journey_milestones", "outcome_id", outcomeId);
  const { data, error } = await supabase.from("learning_journey_milestones").insert({ organization_id: access.organizationId, outcome_id: outcomeId, title, description: input.description ?? null, position }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "MILESTONE_CREATE_FAILED" };
  return { ok: true, data: { id: data.id } };
}

export async function createMission(access: AcademyAdminAccess, milestoneId: string, input: MissionInput): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
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
  return { ok: true, data: { id: data.id } };
}

export async function updateMission(access: AcademyAdminAccess, missionId: string, input: Partial<MissionInput>): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
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
    if (!mission.successCriteria.length) add("warning", "missing_kpi", "Chưa có success KPI", mission);
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

  const blockers = findings.filter((f) => f.severity === "blocker").map((f) => f.missionTitle ? `Mission "${f.missionTitle}": ${f.message}` : f.message);
  const warnings = findings.filter((f) => f.severity === "warning").map((f) => f.missionTitle ? `Mission "${f.missionTitle}": ${f.message}` : f.message);
  return { ok: blockers.length === 0, blockers, warnings, findings };
}

/**
 * Publishes a draft version: archives the blueprint's currently-published version (if any) and
 * points current_published_version_id at this one. Not wrapped in a single database transaction —
 * supabase-js issues each statement as its own request — so a failure between steps could in theory
 * leave the blueprint briefly without a current published version. Accepted for Release A (no
 * student cutover reads current_published_version_id yet); worth a real transaction (an RPC) before
 * Release B puts a student-facing read behind this.
 */
export async function publishVersion(access: AcademyAdminAccess, blueprintId: string, versionId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftVersion(supabase, access.organizationId, versionId);
  if (!draftCheck.ok) return draftCheck;

  const preflight = await preflightVersion(access.organizationId, versionId);
  if (!preflight.ok) return { ok: false, error: `PREFLIGHT_FAILED: ${preflight.blockers.join("; ")}` };

  const { error: archiveError } = await supabase.from("learning_journey_versions").update({ status: "archived" }).eq("organization_id", access.organizationId).eq("blueprint_id", blueprintId).eq("status", "published");
  if (archiveError) return { ok: false, error: archiveError.message };

  const publishedAt = new Date().toISOString();
  const { error: publishError } = await supabase.from("learning_journey_versions").update({ status: "published", published_at: publishedAt }).eq("organization_id", access.organizationId).eq("id", versionId);
  if (publishError) return { ok: false, error: publishError.message };

  const { error: pointerError } = await supabase.from("learning_journey_blueprints").update({ current_published_version_id: versionId, updated_at: publishedAt }).eq("organization_id", access.organizationId).eq("id", blueprintId);
  if (pointerError) return { ok: false, error: pointerError.message };

  return { ok: true, data: null };
}

export async function archiveVersion(access: AcademyAdminAccess, versionId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("learning_journey_versions").update({ status: "archived" }).eq("organization_id", access.organizationId).eq("id", versionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
