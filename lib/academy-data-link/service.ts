import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadCareerStages } from "@/lib/career-stages/service";
import { stageDisplayRank } from "@/lib/career-stages/types";
import { loadBlueprintForStage, loadVersionGraph, resolveResourceTitles } from "@/lib/learn-outcome/service";
import { preflightVersion } from "@/lib/learn-outcome/admin";
import { emitDomainEvent } from "@/lib/domain/events";
import { assertStageContextConsistency } from "./stage-context-validator";
import type { JourneyMission, JourneyOutcome } from "@/lib/learn-outcome/types";
import type {
  AcademyDataLinkResource, AcademySetupStep, CurriculumPlacement, MissionUsage,
  StageLinkHealth, StudentSurfaceUsage, StudentStageContextCheck
} from "./types";

// Same source-table map computeStageHealth (lib/academy-control/health.ts) uses for Curriculum
// integrity — kept separate rather than imported/shared because that map only needs to answer
// "does career_stage_resources.resource_id still exist", while this one also has to resolve
// Mission Resource Binding rows, which additionally allow 'career_stage_resource' (a placement id,
// not a content row at all — never "broken" by this check).
const SOURCE_TABLE: Record<string, string> = {
  book: "books", publication: "publications", template: "templates",
  knowledge_space: "knowledge_spaces", asset: "assets", document: "curriculum_documents"
};

function flattenMissions(outcomes: JourneyOutcome[]): (JourneyMission & { outcomeTitle: string; milestoneTitle: string })[] {
  return outcomes.flatMap((outcome) => outcome.milestones.flatMap((milestone) =>
    milestone.missions.map((mission) => ({ ...mission, outcomeTitle: outcome.title, milestoneTitle: milestone.title }))
  ));
}

/** Which resource bindings point at a row that no longer exists — batched per table, not per binding. */
async function countBrokenBindings(bindings: { resourceType: string; resourceId: string }[]): Promise<number> {
  const admin = createSupabaseAdminClient();
  if (!admin || !bindings.length) return 0;
  const byTable = new Map<string, string[]>();
  for (const binding of bindings) {
    const table = SOURCE_TABLE[binding.resourceType];
    if (!table) continue; // 'career_stage_resource' and unknown types are never counted as broken here.
    byTable.set(table, [...(byTable.get(table) ?? []), binding.resourceId]);
  }
  let broken = 0;
  await Promise.all([...byTable].map(async ([table, ids]) => {
    const uniqueIds = [...new Set(ids)];
    const { data, error } = await admin.from(table).select("id").in("id", uniqueIds);
    if (error) return; // A table this deployment lacks is not a broken-binding problem.
    const found = new Set((data ?? []).map((row: { id: string }) => String(row.id)));
    broken += uniqueIds.filter((id) => !found.has(id)).length;
  }));
  return broken;
}

interface StageFacts {
  stageId: string; stageTitle: string; stagePosition: number;
  nodeCount: number; containerCount: number; containersWithResource: number;
  resourceCount: number;
  blueprintId: string | null; publishedVersionId: string | null;
  versionCount: number; activeVersionId: string | null;
  missions: (JourneyMission & { outcomeTitle: string; milestoneTitle: string })[];
  outcomeCount: number;
}

/** Everything both getStageLinkHealth and getSetupGuideState need, fetched once. */
async function loadStageFacts(organizationId: string, stageId: string): Promise<StageFacts | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const [stages, { data: nodeRows }, blueprint] = await Promise.all([
    loadCareerStages(organizationId, { includeHidden: true }),
    admin.from("academy_stage_nodes").select("id,node_type").eq("organization_id", organizationId).eq("stage_id", stageId).neq("status", "archived"),
    loadBlueprintForStage(organizationId, stageId)
  ]);
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return null;

  const nodes = (nodeRows ?? []) as { id: string; node_type: string }[];
  const containers = nodes.filter((n) => n.node_type === "module" || n.node_type === "group");
  const resourcesWithNode = stage.resources.filter((r) => r.nodeId);
  const containerIdsWithResource = new Set(resourcesWithNode.map((r) => r.nodeId));
  const containersWithResource = containers.filter((c) => containerIdsWithResource.has(c.id)).length;

  let versionCount = 0;
  let activeVersionId: string | null = null;
  if (blueprint) {
    const { data: versionRows } = await admin.from("learning_journey_versions").select("id,version_number,status").eq("organization_id", organizationId).eq("blueprint_id", blueprint.id).order("version_number", { ascending: false });
    const versions = (versionRows ?? []) as { id: string; version_number: number; status: string }[];
    versionCount = versions.length;
    activeVersionId = blueprint.currentPublishedVersionId ?? versions[0]?.id ?? null;
  }

  const outcomes = activeVersionId ? await loadVersionGraph(organizationId, activeVersionId) : [];
  const missions = flattenMissions(outcomes);

  // Rank among ACTIVE Stages only — the same set students actually see (lib/career-stages/service.ts's
  // stageDisplayRank doc comment explains why raw .position is wrong here: this org's real curriculum
  // sits at position 5-10, not 0-5, because archived legacy Stages occupy the earlier positions). A
  // hidden/draft Stage being audited before publish has no rank yet (0) — it has none to show students.
  const activeStages = stages.filter((s) => s.status === "active");
  const stagePosition = stageDisplayRank(activeStages, stage.id);

  return {
    stageId: stage.id, stageTitle: stage.title, stagePosition,
    nodeCount: nodes.length, containerCount: containers.length, containersWithResource,
    resourceCount: stage.resources.length,
    blueprintId: blueprint?.id ?? null, publishedVersionId: blueprint?.currentPublishedVersionId ?? null,
    versionCount, activeVersionId, missions, outcomeCount: outcomes.length
  };
}

export async function getStageLinkHealth(organizationId: string, stageId: string): Promise<StageLinkHealth> {
  const facts = await loadStageFacts(organizationId, stageId);
  if (!facts) {
    return { stageId, stageTitle: "", stagePosition: 0, curriculumNodeCount: 0, curriculumResourceCount: 0, journeyVersionCount: 0, publishedJourney: false, missionCount: 0, missionsWithResources: 0, missionsMissingSuccessCriteria: 0, brokenResourceBindings: 0, studentSurfaceErrors: 0, score: 0, warnings: ["Không tìm thấy giai đoạn này."] };
  }

  const allBindings = facts.missions.flatMap((m) => m.resourceBindings);
  const [brokenResourceBindings, mismatches] = await Promise.all([
    countBrokenBindings(allBindings.map((b) => ({ resourceType: b.resourceType, resourceId: b.resourceId }))),
    listStudentStageContextChecks(organizationId, { stageId })
  ]);

  const missionsWithResources = facts.missions.filter((m) => m.resourceBindings.length > 0).length;
  const missionsMissingSuccessCriteria = facts.missions.filter((m) => m.successCriteria.length === 0).length;
  const studentSurfaceErrors = mismatches.filter((c) => !c.isConsistent).length;

  const warnings: string[] = [];
  if (facts.nodeCount === 0) warnings.push("Chưa có Program/Module/Group nào.");
  if (facts.resourceCount === 0) warnings.push("Chưa gắn học liệu nào vào Curriculum.");
  if (!facts.activeVersionId) warnings.push("Chưa có Bản đồ kết quả học viên (Journey Version) cho giai đoạn này.");
  if (facts.missions.length > 0 && missionsWithResources < facts.missions.length) warnings.push(`${facts.missions.length - missionsWithResources} Nhiệm vụ chưa có học liệu liên kết.`);
  if (missionsMissingSuccessCriteria > 0) warnings.push(`${missionsMissingSuccessCriteria} Nhiệm vụ chưa có Tiêu chí đạt.`);
  if (brokenResourceBindings > 0) warnings.push(`${brokenResourceBindings} học liệu liên kết trỏ tới nội dung đã bị xóa.`);
  if (studentSurfaceErrors > 0) warnings.push(`${studentSurfaceErrors} học viên đang thấy Stage Context không khớp — xem Stage Context Validator.`);
  if (!facts.publishedVersionId && facts.activeVersionId) warnings.push("Có bản nháp Journey nhưng chưa áp dụng cho học viên.");

  const totalBindings = allBindings.length;
  const structureLinked = facts.nodeCount > 0 && facts.resourceCount > 0 ? 100 : facts.nodeCount > 0 || facts.resourceCount > 0 ? 50 : 0;
  const journeyLinked = facts.missions.length > 0 ? 100 : facts.outcomeCount > 0 ? 40 : 0;
  const bindingCoverage = facts.missions.length > 0 ? Math.round((missionsWithResources / facts.missions.length) * 100) : 0;
  const integrityCoverage = totalBindings > 0 ? Math.round(((totalBindings - brokenResourceBindings) / totalBindings) * 100) : 100;
  const successCriteriaCoverage = facts.missions.length > 0 ? Math.round(((facts.missions.length - missionsMissingSuccessCriteria) / facts.missions.length) * 100) : 0;
  const contextIntegrity = mismatches.length > 0 ? Math.round(((mismatches.length - studentSurfaceErrors) / mismatches.length) * 100) : 100;
  const score = Math.round((structureLinked + journeyLinked + bindingCoverage + integrityCoverage + successCriteriaCoverage + contextIntegrity) / 6);

  return {
    stageId: facts.stageId, stageTitle: facts.stageTitle, stagePosition: facts.stagePosition,
    curriculumNodeCount: facts.nodeCount, curriculumResourceCount: facts.resourceCount,
    journeyVersionCount: facts.versionCount, publishedJourney: Boolean(facts.publishedVersionId),
    missionCount: facts.missions.length, missionsWithResources, missionsMissingSuccessCriteria,
    brokenResourceBindings, studentSurfaceErrors, score, warnings
  };
}

export async function getSetupGuideState(organizationId: string, stageId: string): Promise<AcademySetupStep[]> {
  const facts = await loadStageFacts(organizationId, stageId);
  const qs = `?stageId=${stageId}`;
  if (!facts) return [];

  const steps: AcademySetupStep[] = [];
  steps.push({ id: 1, title: "Tạo Giai đoạn", description: "Xác định tên, thứ tự, mô tả, thời lượng và mục tiêu.", state: "complete", actionLabel: "Mở Giai đoạn", actionHref: `/academy-admin/stages/${stageId}` });

  steps.push({
    id: 2, title: "Xây Program → Module → Group", description: "Tạo cây kiến thức đào tạo.",
    state: facts.nodeCount === 0 ? "not_started" : "complete",
    helper: facts.nodeCount === 0 ? null : `${facts.nodeCount} mục cấu trúc.`,
    actionLabel: "Xây cấu trúc", actionHref: `/academy-admin/stages/${stageId}?view=structure`
  });

  const step3State = facts.resourceCount === 0 ? "not_started" : facts.containerCount > 0 && facts.containersWithResource < facts.containerCount ? "in_progress" : "complete";
  steps.push({
    id: 3, title: "Gắn học liệu vào Curriculum", description: "Gắn sách, video, SOP, checklist, tool và template.",
    state: step3State, helper: facts.resourceCount === 0 ? null : `${facts.resourceCount} học liệu · ${facts.containersWithResource}/${facts.containerCount || 0} học phần/nhóm đã có tài liệu.`,
    actionLabel: "Gắn học liệu", actionHref: `/academy-admin/stages/${stageId}?view=structure`
  });

  steps.push({
    id: 4, title: "Mở Bản đồ kết quả học viên", description: "Tạo hoặc chọn Journey Version.",
    state: facts.blueprintId ? "complete" : "not_started",
    actionLabel: "Mở Bản đồ", actionHref: `/academy-admin/journey${qs}`
  });

  const step5State = facts.outcomeCount === 0 ? "not_started" : facts.missions.length === 0 ? "in_progress" : "complete";
  steps.push({
    id: 5, title: "Tạo Kết quả → Chặng → Nhiệm vụ", description: "Xây con đường hành động tạo kết quả.",
    state: step5State, helper: facts.outcomeCount === 0 ? null : `${facts.outcomeCount} Kết quả · ${facts.missions.length} Nhiệm vụ.`,
    actionLabel: "Xây Journey", actionHref: `/academy-admin/journey${qs}`
  });

  const missionsWithResources = facts.missions.filter((m) => m.resourceBindings.length > 0).length;
  const step6State = facts.missions.length === 0 ? "not_started" : missionsWithResources === 0 ? "not_started" : missionsWithResources < facts.missions.length ? "in_progress" : "complete";
  steps.push({
    id: 6, title: "Gắn Học liệu cho từng Nhiệm vụ", description: "Chọn từ Curriculum/Kho nội dung, không sao chép.",
    state: step6State, helper: facts.missions.length === 0 ? null : `${missionsWithResources}/${facts.missions.length} Nhiệm vụ đã có học liệu.`,
    actionLabel: "Gắn học liệu", actionHref: `/academy-admin/journey${qs}`
  });

  let step7State: AcademySetupStep["state"] = "not_started";
  let step7Helper: string | null = null;
  if (facts.activeVersionId) {
    const preflight = await preflightVersion(organizationId, facts.activeVersionId);
    step7State = preflight.blockers.length > 0 ? "warning" : preflight.warnings.length > 0 ? "in_progress" : "complete";
    step7Helper = preflight.blockers.length > 0 ? `${preflight.blockers.length} lỗi cần sửa.` : preflight.warnings.length > 0 ? `${preflight.warnings.length} cảnh báo.` : "Không có lỗi chặn.";
  }
  steps.push({ id: 7, title: "Thiết lập hành động và tiêu chuẩn đạt", description: "Việc cần làm → Evidence → Tiêu chí đạt → Kết quả.", state: step7State, helper: step7Helper, actionLabel: "Hoàn thiện Nhiệm vụ", actionHref: `/academy-admin/journey${qs}` });

  let step8State: AcademySetupStep["state"] = "not_started";
  let step8Helper: string | null = "Cần kiểm tra: chưa thấy lượt Kiểm tra (Preflight) nào được ghi lại cho phiên bản này.";
  if (facts.activeVersionId) {
    const admin = createSupabaseAdminClient();
    const { data: previewEvents } = admin
      ? await admin.from("domain_events").select("id").eq("organization_id", organizationId).eq("resource_type", "learning_journey_versions").eq("resource_id", facts.activeVersionId).eq("event_name", "journey.version_preflighted").limit(1)
      : { data: [] };
    if ((previewEvents ?? []).length > 0) { step8State = "complete"; step8Helper = "Đã có lượt Kiểm tra được ghi lại."; }
    else if (step7State === "complete") { step8State = "warning"; }
  }
  steps.push({ id: 8, title: "Kiểm tra như học viên", description: "Preview Journey, Mission Workspace, Library và quyền truy cập.", state: step8State, helper: step8Helper, actionLabel: "Xem như học viên", actionHref: `/academy-admin/journey${qs}` });

  steps.push({
    id: 9, title: "Áp dụng Journey Version", description: "Sau khi kiểm tra đạt, áp dụng phiên bản.",
    state: facts.publishedVersionId ? "complete" : facts.activeVersionId ? "in_progress" : "not_started",
    actionLabel: "Kiểm tra & áp dụng", actionHref: `/academy-admin/journey${qs}`
  });

  const contextChecks = await listStudentStageContextChecks(organizationId, { stageId });
  const step10State: AcademySetupStep["state"] = contextChecks.length === 0 ? "not_started" : contextChecks.some((c) => !c.isConsistent) ? "warning" : "complete";
  steps.push({
    id: 10, title: "Xác nhận dữ liệu học viên đã đồng bộ", description: "Kiểm tra Stage, Journey, Mission, Library và quyền truy cập.",
    state: step10State, helper: contextChecks.length === 0 ? "Chưa có học viên thật nào ở giai đoạn này để kiểm tra." : `${contextChecks.filter((c) => c.isConsistent).length}/${contextChecks.length} học viên khớp Stage Context.`,
    actionLabel: "Kiểm tra đồng bộ", actionHref: "/academy-admin/data-link" + qs
  });

  return steps;
}

/**
 * Resource Data Link Inspector + Mission Resource Origin (§ same feature, two directions):
 * curriculum placements = career_stage_resources rows sharing this exact resource_type/resource_id;
 * mission usages = learning_mission_resource_bindings rows sharing it. Never a copy of the resource —
 * both point at the same (resourceType, resourceId), which is exactly what makes this a link view
 * and not a second catalog.
 */
export async function getResourceDataLink(organizationId: string, resourceType: string, resourceId: string): Promise<AcademyDataLinkResource | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const [{ data: placementRows }, { data: bindingRows }, titleMap] = await Promise.all([
    admin.from("career_stage_resources").select("id,stage_id,node_id,title_override").eq("organization_id", organizationId).eq("resource_type", resourceType).eq("resource_id", resourceId).neq("status", "archived"),
    admin.from("learning_mission_resource_bindings").select("id,mission_id,role").eq("organization_id", organizationId).eq("resource_type", resourceType).eq("resource_id", resourceId),
    resolveResourceTitles(organizationId, [{ resourceType, resourceId }])
  ]);

  const placements = (placementRows ?? []) as { id: string; stage_id: string; node_id: string | null; title_override: string | null }[];
  const bindings = (bindingRows ?? []) as { id: string; mission_id: string; role: string }[];
  const title = titleMap.get(resourceId) ?? placements.find((p) => p.title_override)?.title_override ?? resourceId;

  const nodeIds = [...new Set(placements.map((p) => p.node_id).filter((id): id is string => Boolean(id)))];
  const [activeStages, { data: nodeRows }] = await Promise.all([
    loadCareerStages(organizationId),
    nodeIds.length ? admin.from("academy_stage_nodes").select("id,parent_id,node_type,title").in("id", nodeIds) : Promise.resolve({ data: [] })
  ]);
  const stageById = new Map(activeStages.map((s) => [s.id, s]));
  const nodeById = new Map(((nodeRows ?? []) as { id: string; parent_id: string | null; node_type: string; title: string }[]).map((n) => [n.id, n]));

  // A node's ancestors might not be in nodeIds (only the leaf placement node was fetched), so walk
  // up via a second small batch — Program/Module/Group is at most 3 levels, never unbounded.
  const missingAncestorIds = [...nodeById.values()].map((n) => n.parent_id).filter((id): id is string => id !== null && !nodeById.has(id));
  if (missingAncestorIds.length) {
    const { data: ancestorRows } = await admin.from("academy_stage_nodes").select("id,parent_id,node_type,title").in("id", [...new Set(missingAncestorIds)]);
    for (const row of (ancestorRows ?? []) as { id: string; parent_id: string | null; node_type: string; title: string }[]) nodeById.set(row.id, row);
  }

  function nodeChain(nodeId: string | null): { programTitle: string | null; moduleTitle: string | null; groupTitle: string | null } {
    const chain = { programTitle: null as string | null, moduleTitle: null as string | null, groupTitle: null as string | null };
    let current = nodeId ? nodeById.get(nodeId) : undefined;
    while (current) {
      if (current.node_type === "program") chain.programTitle = current.title;
      if (current.node_type === "module") chain.moduleTitle = current.title;
      if (current.node_type === "group") chain.groupTitle = current.title;
      current = current.parent_id ? nodeById.get(current.parent_id) : undefined;
    }
    return chain;
  }

  const curriculumPlacements: CurriculumPlacement[] = placements.map((p) => {
    const stage = stageById.get(p.stage_id);
    const chain = nodeChain(p.node_id);
    return { stageId: p.stage_id, stageTitle: stage?.title ?? "", stagePosition: stageDisplayRank(activeStages, p.stage_id), nodeId: p.node_id, ...chain };
  });

  const missionIds = bindings.map((b) => b.mission_id);
  const missionUsages: MissionUsage[] = missionIds.length ? await resolveMissionUsages(organizationId, bindings) : [];

  // Student surfaces reuse career_stage_resources.display_locations (already the real, admin-set
  // "where this shows up" list) rather than re-deriving visibility from scratch — a second
  // derivation is exactly the kind of parallel logic that could disagree with what Admin configured.
  const surfaceSeeds: StudentSurfaceUsage[] = ["library", "journey", "smart_home"].map((surface) => ({ surface, visible: false, accessState: "locked" }));
  const studentSurfaces = await withDisplayLocations(admin, organizationId, resourceType, resourceId, surfaceSeeds, curriculumPlacements.length > 0);

  return { resourceType, resourceId, title, curriculumPlacements, missionUsages, studentSurfaces };
}

async function withDisplayLocations(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, organizationId: string, resourceType: string, resourceId: string, base: StudentSurfaceUsage[], hasPlacement: boolean): Promise<StudentSurfaceUsage[]> {
  if (!hasPlacement) return base.map((s) => ({ ...s, visible: false, accessState: "locked", reason: "Chưa được gắn vào Curriculum." }));
  const { data } = await admin.from("career_stage_resources").select("display_locations,access").eq("organization_id", organizationId).eq("resource_type", resourceType).eq("resource_id", resourceId).neq("status", "archived");
  const rows = (data ?? []) as { display_locations: string[] | null; access: string }[];
  const locations = new Set(rows.flatMap((r) => r.display_locations ?? []));
  const entitlementOnly = rows.every((r) => r.access === "entitlement_only") && rows.length > 0;
  return base.map((s) => ({
    surface: s.surface,
    visible: locations.has(s.surface),
    accessState: entitlementOnly ? "conditional" : "open",
    reason: entitlementOnly ? "Chỉ hiện khi học viên được cấp quyền riêng." : null
  }));
}

async function resolveMissionUsages(organizationId: string, bindings: { mission_id: string; role: string }[]): Promise<MissionUsage[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const missionIds = [...new Set(bindings.map((b) => b.mission_id))];
  const { data: missionRows } = await admin.from("learning_journey_missions").select("id,title,milestone_id").eq("organization_id", organizationId).in("id", missionIds);
  const missions = (missionRows ?? []) as { id: string; title: string; milestone_id: string }[];
  const milestoneIds = [...new Set(missions.map((m) => m.milestone_id))];
  const { data: milestoneRows } = milestoneIds.length ? await admin.from("learning_journey_milestones").select("id,title,outcome_id").in("id", milestoneIds) : { data: [] };
  const milestones = (milestoneRows ?? []) as { id: string; title: string; outcome_id: string }[];
  const outcomeIds = [...new Set(milestones.map((m) => m.outcome_id))];
  const { data: outcomeRows } = outcomeIds.length ? await admin.from("learning_journey_outcomes").select("id,title,version_id").in("id", outcomeIds) : { data: [] };
  const outcomes = (outcomeRows ?? []) as { id: string; title: string; version_id: string }[];
  const versionIds = [...new Set(outcomes.map((o) => o.version_id))];
  const { data: versionRows } = versionIds.length ? await admin.from("learning_journey_versions").select("id,status").in("id", versionIds) : { data: [] };
  const versions = (versionRows ?? []) as { id: string; status: string }[];

  const milestoneById = new Map(milestones.map((m) => [m.id, m]));
  const outcomeById = new Map(outcomes.map((o) => [o.id, o]));
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const missionById = new Map(missions.map((m) => [m.id, m]));

  return bindings.map((b): MissionUsage | null => {
    const mission = missionById.get(b.mission_id);
    if (!mission) return null;
    const milestone = milestoneById.get(mission.milestone_id);
    const outcome = milestone ? outcomeById.get(milestone.outcome_id) : undefined;
    const version = outcome ? versionById.get(outcome.version_id) : undefined;
    return {
      journeyVersionId: outcome?.version_id ?? "", missionId: mission.id, missionTitle: mission.title,
      outcomeTitle: outcome?.title ?? null, milestoneTitle: milestone?.title ?? null,
      bindingRole: b.role, published: version?.status === "published"
    };
  }).filter((u): u is MissionUsage => u !== null);
}

/**
 * Fix P1 (docs/academy-data-link-v1/01_PRODUCTION_AUDIT.md): cross-checks 2 independent readings of
 * "what Stage is this student in" for real students —
 *   assignedStageId (= resolvedStageId — this system has no separate manual-assignment table, the
 *     unlock resolver IS the assignment; kept as two fields to match the source package's port shape):
 *     the same derivation app/student/courses/page.tsx uses (highest-position Stage the student has
 *     unlocked, from career_stages.position/slug — never membership level, version, or array index)
 *   journeyStageId: the Stage backing whichever Mission the student most recently touched
 *     (student_mission_states.updated_at) — a completely independent path through the data
 * If they disagree, that is a genuine surface bug, not a hypothetical — the Mission Workspace badge
 * bug found in the audit is exactly the kind of thing this would have caught in production.
 */
export async function listStudentStageContextChecks(organizationId: string, filter?: { stageId?: string }): Promise<StudentStageContextCheck[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const [{ data: memberRows }, stages] = await Promise.all([
    admin.from("organization_members").select("user_id,profiles(full_name)").eq("organization_id", organizationId).eq("role", "student").eq("status", "active"),
    loadCareerStages(organizationId)
  ]);
  const students = ((memberRows ?? []) as { user_id: string; profiles: { full_name: string | null } | { full_name: string | null }[] | null }[]).map((row) => ({
    id: String(row.user_id),
    name: String((Array.isArray(row.profiles) ? row.profiles[0]?.full_name : row.profiles?.full_name) ?? "Học viên")
  }));
  if (!students.length || !stages.length) return [];

  const stageById = new Map(stages.map((s) => [s.id, s]));

  // "Journey stage" per student — the Stage owning the blueprint behind their most recently touched
  // Mission. One query for every student's latest row, then one batch of joins, not N+1.
  const { data: stateRows } = await admin
    .from("student_mission_states")
    .select("student_id,mission_id,updated_at")
    .eq("organization_id", organizationId)
    .in("student_id", students.map((s) => s.id))
    .order("updated_at", { ascending: false });
  const latestByStudent = new Map<string, { mission_id: string }>();
  for (const row of (stateRows ?? []) as { student_id: string; mission_id: string; updated_at: string }[]) {
    if (!latestByStudent.has(row.student_id)) latestByStudent.set(row.student_id, row);
  }
  const missionIds = [...new Set([...latestByStudent.values()].map((r) => r.mission_id))];
  const { data: missionRows } = missionIds.length ? await admin.from("learning_journey_missions").select("id,milestone_id").in("id", missionIds) : { data: [] };
  const missions = (missionRows ?? []) as { id: string; milestone_id: string }[];
  const milestoneIds = [...new Set(missions.map((m) => m.milestone_id))];
  const { data: milestoneRows } = milestoneIds.length ? await admin.from("learning_journey_milestones").select("id,outcome_id").in("id", milestoneIds) : { data: [] };
  const milestones = (milestoneRows ?? []) as { id: string; outcome_id: string }[];
  const outcomeIds = [...new Set(milestones.map((m) => m.outcome_id))];
  const { data: outcomeRows } = outcomeIds.length ? await admin.from("learning_journey_outcomes").select("id,version_id").in("id", outcomeIds) : { data: [] };
  const outcomes = (outcomeRows ?? []) as { id: string; version_id: string }[];
  const versionIds = [...new Set(outcomes.map((o) => o.version_id))];
  const { data: versionRows } = versionIds.length ? await admin.from("learning_journey_versions").select("id,blueprint_id").in("id", versionIds) : { data: [] };
  const versions = (versionRows ?? []) as { id: string; blueprint_id: string }[];
  const blueprintIds = [...new Set(versions.map((v) => v.blueprint_id))];
  const { data: blueprintRows } = blueprintIds.length ? await admin.from("learning_journey_blueprints").select("id,stage_id").in("id", blueprintIds) : { data: [] };
  const blueprints = (blueprintRows ?? []) as { id: string; stage_id: string }[];

  const missionById = new Map(missions.map((m) => [m.id, m]));
  const milestoneById = new Map(milestones.map((m) => [m.id, m]));
  const outcomeById = new Map(outcomes.map((o) => [o.id, o]));
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const blueprintById = new Map(blueprints.map((b) => [b.id, b]));

  function journeyStageIdFor(studentId: string): string | null {
    const latest = latestByStudent.get(studentId);
    const mission = latest ? missionById.get(latest.mission_id) : undefined;
    const milestone = mission ? milestoneById.get(mission.milestone_id) : undefined;
    const outcome = milestone ? outcomeById.get(milestone.outcome_id) : undefined;
    const version = outcome ? versionById.get(outcome.version_id) : undefined;
    const blueprint = version ? blueprintById.get(version.blueprint_id) : undefined;
    return blueprint?.stage_id ?? null;
  }

  // Batched restatement of getUnlockedStageIds (lib/student/stage-access.ts) for every student at
  // once — that function is written for a single request-scoped student, and calling it per student
  // here would turn this into exactly the N+1 §18 tests against.
  const nowIso = new Date().toISOString();
  const studentIds = students.map((s) => s.id);
  const [{ data: membershipRows }, { data: grantRows }] = await Promise.all([
    admin.from("memberships").select("user_id").eq("organization_id", organizationId).eq("status", "active").in("user_id", studentIds).or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    admin.from("business_feature_grants").select("user_id,feature_slug").eq("organization_id", organizationId).eq("source_type", "manual_grant").is("revoked_at", null).in("user_id", studentIds).or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  ]);
  const membershipStudentIds = new Set(((membershipRows ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const grantsByStudent = new Map<string, Set<string>>();
  for (const row of (grantRows ?? []) as { user_id: string; feature_slug: string }[]) {
    if (!grantsByStudent.has(row.user_id)) grantsByStudent.set(row.user_id, new Set());
    grantsByStudent.get(row.user_id)!.add(row.feature_slug);
  }
  const orderedStages = [...stages].sort((a, b) => a.position - b.position);

  const results: StudentStageContextCheck[] = [];
  for (const student of students) {
    const unlocked = new Set<string>();
    if (orderedStages[0]) unlocked.add(orderedStages[0].slug);
    if (membershipStudentIds.has(student.id)) for (const s of orderedStages) unlocked.add(s.slug);
    for (const slug of grantsByStudent.get(student.id) ?? []) unlocked.add(slug);

    const orderedUnlocked = [...orderedStages].reverse().filter((s) => unlocked.has(s.slug));
    const assignedStage = orderedUnlocked[0] ?? orderedStages[0];
    if (!assignedStage) continue;

    const journeyStageId = journeyStageIdFor(student.id);
    if (!journeyStageId && !filter?.stageId) continue; // no real activity yet — nothing to cross-check.
    if (filter?.stageId && assignedStage.id !== filter.stageId && journeyStageId !== filter.stageId) continue;

    const journeyStage = journeyStageId ? stageById.get(journeyStageId) : null;
    const { isConsistent, issues } = assertStageContextConsistency({ assignedStageId: assignedStage.id, journeyStageId });

    const assignedRank = stageDisplayRank(orderedStages, assignedStage.id);
    results.push({
      studentId: student.id, studentName: student.name,
      assignedStageId: assignedStage.id, assignedStageTitle: assignedStage.title, assignedStagePosition: assignedRank,
      resolvedStageId: assignedStage.id, resolvedStagePosition: assignedRank,
      journeyStageId, journeyStagePosition: journeyStage ? stageDisplayRank(orderedStages, journeyStage.id) : null,
      isConsistent, issues
    });
  }
  return results;
}

/**
 * Logs a domain_event for each mismatch found — kept separate from listStudentStageContextChecks
 * (a plain read, called from getStageLinkHealth/getSetupGuideState too) so a health-score refresh
 * never has the side effect of writing rows. Only the Data Link page's own Stage Context Validator
 * panel calls this, once per explicit view — the same "read vs explicit action" split
 * journey.version_preflighted (POST-only) already follows elsewhere in this codebase.
 */
export async function logStageContextMismatches(organizationId: string, checks: StudentStageContextCheck[]): Promise<void> {
  const mismatches = checks.filter((c) => !c.isConsistent);
  await Promise.all(mismatches.map((check) => emitDomainEvent({
    organizationId, actorId: check.studentId, resourceType: "career_stages", resourceId: check.assignedStageId,
    eventName: "student.stage_context_mismatch",
    payload: { studentId: check.studentId, assignedStageId: check.assignedStageId, journeyStageId: check.journeyStageId, issues: check.issues }
  }).catch(() => {})));
}
