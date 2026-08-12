import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeSelfReportedMission, getJourneyForStudent, startMission, submitEvidence } from "@/lib/learn-outcome/student";
import type { MissionDisplayState, MissionWithProgress } from "@/lib/learn-outcome/student";
import { loadCareerStages } from "@/lib/career-stages/service";
import { stageDisplayRank } from "@/lib/career-stages/types";
import { getWorkspaceConfig, getStudentBlockValues } from "./service";
import type { MissionBlock, StudentBlockValue } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Walks Mission -> Milestone -> Outcome -> Version -> Blueprint -> Stage to find which Stage a
 * Mission id belongs to, without the caller (a /student/missions/[missionId] route with no Stage
 * in the URL) needing to know it upfront. Every hop is scoped to organizationId, so a missionId
 * from another org simply resolves to null here — the same "wrong org just 404s" shape as
 * app/student/document/[id]'s content-access check.
 */
async function findMissionStage(organizationId: string, missionId: string): Promise<{ id: string; title: string; indexLabel: string; displayRank: number } | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const mission = await admin.from("learning_journey_missions").select("milestone_id").eq("organization_id", organizationId).eq("id", missionId).maybeSingle();
  if (!mission.data) return null;
  const milestone = await admin.from("learning_journey_milestones").select("outcome_id").eq("organization_id", organizationId).eq("id", (mission.data as { milestone_id: string }).milestone_id).maybeSingle();
  if (!milestone.data) return null;
  const outcome = await admin.from("learning_journey_outcomes").select("version_id").eq("organization_id", organizationId).eq("id", (milestone.data as { outcome_id: string }).outcome_id).maybeSingle();
  if (!outcome.data) return null;
  const version = await admin.from("learning_journey_versions").select("blueprint_id").eq("organization_id", organizationId).eq("id", (outcome.data as { version_id: string }).version_id).maybeSingle();
  if (!version.data) return null;
  const blueprint = await admin.from("learning_journey_blueprints").select("stage_id").eq("organization_id", organizationId).eq("id", (version.data as { blueprint_id: string }).blueprint_id).maybeSingle();
  if (!blueprint.data) return null;
  const stages = await loadCareerStages(organizationId);
  const stage = stages.find((s) => s.id === (blueprint.data as { stage_id: string }).stage_id);
  // stageDisplayRank (a real, DB-derived rank-among-active-Stages) is the only number the
  // student-facing badge may use — indexLabel is admin-editable free text that can drift from it,
  // and raw .position is a never-reclaimed counter that also counts archived/legacy Stages (this
  // org's real curriculum sits at position 5-10, not 0-5). docs/academy-data-link-v1/
  // 01_PRODUCTION_AUDIT.md's P1: the Roadmap and Mission Workspace must show the same number for
  // the same Stage — both now derive it the same way, not from two different raw columns.
  return stage ? { id: stage.id, title: stage.title, indexLabel: stage.indexLabel, displayRank: stageDisplayRank(stages, stage.id) } : null;
}

export interface MissionSibling { id: string; title: string; displayState: MissionDisplayState; lockedReason: string | null; outcomeTitle: string }

export interface MissionContext {
  stage: { id: string; title: string; indexLabel: string; displayRank: number };
  outcome: { id: string; title: string };
  milestone: { id: string; title: string };
  mission: MissionWithProgress;
  versionId: string;
  blueprintTitle: string | null;
  journeyProgressPercent: number;
  /** Every mission in this stage's journey, in order — the Workspace's left "Journey Context" rail. Comes from the graph already loaded above, so it costs no extra query. */
  siblings: MissionSibling[];
  /** Title of the mission this one unlocks, if any — powers the honest, non-AI "Roadmap Impact" line. */
  unlocksMissionTitle: string | null;
  /** Progress of the outcome this mission belongs to (share of its missions that reached result_achieved). */
  outcomeProgressPercent: number;
}

/**
 * Resolves a Mission through the exact same read model the Roadmap uses
 * (lib/learn-outcome/student.ts's getJourneyForStudent), which only ever walks a stage's
 * *published* Journey version. A Mission that only exists in a Draft, or belongs to another org's
 * Stage, is simply absent from that graph — there is no second, looser lookup here. That is what
 * makes a direct /student/missions/[missionId] URL unable to see Draft content or skip prerequisite
 * locking (mandatory tests #2, #5, #6 from the source package): the route and the Roadmap share one
 * function, not two that could drift.
 */
export async function resolveMissionContext(userId: string, organizationId: string, missionId: string): Promise<MissionContext | null> {
  const stage = await findMissionStage(organizationId, missionId);
  if (!stage) return null;
  const journey = await getJourneyForStudent(userId, organizationId, stage.id);
  if (!journey?.versionId) return null;

  const allMissions = journey.outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions));
  const unlocks = allMissions.find((m) => m.prerequisiteMissionId === missionId);

  for (const outcome of journey.outcomes) {
    for (const milestone of outcome.milestones) {
      const mission = milestone.missions.find((m) => m.id === missionId);
      if (!mission) continue;
      const outcomeMissions = outcome.milestones.flatMap((ms) => ms.missions);
      const achieved = outcomeMissions.filter((m) => m.displayState === "result_achieved" || m.displayState === "verified").length;
      // Local Outcome path only — previous/current/next Mission within THIS Outcome, not every
      // Mission in the Stage (v5/32-.../CLAUDE_H2OBOOK_LEARN_OUTCOME_OS_V4.md §2: "Do not render
      // all Stage Missions"). Reversing the folder-30 Workspace, which showed the full sibling list.
      const indexInOutcome = outcomeMissions.findIndex((m) => m.id === missionId);
      const siblings: MissionSibling[] = outcomeMissions.slice(Math.max(0, indexInOutcome - 1), indexInOutcome + 2)
        .map((m) => ({ id: m.id, title: m.title, displayState: m.displayState, lockedReason: m.lockedReason, outcomeTitle: outcome.title }));
      return {
        stage, outcome: { id: outcome.id, title: outcome.title }, milestone: { id: milestone.id, title: milestone.title },
        mission, versionId: journey.versionId, blueprintTitle: journey.blueprintTitle, journeyProgressPercent: journey.progressPercent,
        siblings, unlocksMissionTitle: unlocks?.title ?? null,
        outcomeProgressPercent: outcomeMissions.length ? Math.round((achieved / outcomeMissions.length) * 100) : 0
      };
    }
  }
  return null;
}

/**
 * Every student write against a Mission goes through here first.
 *
 * The underlying writers in lib/learn-outcome/student.ts take a caller-supplied
 * blueprintVersionId and never check whether the Mission is actually reachable — which meant a
 * student could POST a *locked* mission's id straight to /api/student/journey/mission and start it,
 * or pin their state row to any version id they chose, bypassing the prerequisite chain the UI
 * enforces (mandatory test #5, and the behaviour the source package's own mission-service.ts
 * spells out: "if (mission.state === 'locked') throw"). Resolving the context server-side closes
 * both holes at once: the version comes from the published journey, and a locked or unreachable
 * mission never reaches the writer.
 */
async function requireOpenMission(userId: string, organizationId: string, missionId: string): Promise<Result<MissionContext>> {
  const context = await resolveMissionContext(userId, organizationId, missionId);
  if (!context) return { ok: false, error: "MISSION_NOT_ACCESSIBLE" };
  if (context.mission.displayState === "locked") return { ok: false, error: "MISSION_LOCKED" };
  return { ok: true, data: context };
}

export async function startMissionForStudent(userId: string, organizationId: string, missionId: string): Promise<Result<{ created: boolean }>> {
  const guard = await requireOpenMission(userId, organizationId, missionId);
  if (!guard.ok) return guard;
  return startMission(userId, organizationId, missionId, guard.data.versionId);
}

export async function completeSelfReportedMissionForStudent(userId: string, organizationId: string, missionId: string): Promise<Result<null>> {
  const guard = await requireOpenMission(userId, organizationId, missionId);
  if (!guard.ok) return guard;
  return completeSelfReportedMission(userId, organizationId, missionId, guard.data.versionId);
}

export async function submitEvidenceForStudent(userId: string, organizationId: string, missionId: string, evidence: { note?: string; assetId?: string }): Promise<Result<null>> {
  const guard = await requireOpenMission(userId, organizationId, missionId);
  if (!guard.ok) return guard;
  return submitEvidence(userId, organizationId, missionId, guard.data.versionId, evidence);
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

export interface MissionReadiness { score: number; missingRequiredBlockIds: string[] }

/**
 * Deterministic readiness, adapted from the source package's suggested weights
 * (v5/30-.../CLAUDE_INTEGRATION_PROMPT.md §9: inputs 35 / actions 30 / criteria 25 / evidence 10).
 * Dropped the "criteria" component: success_criteria (migration 0050) is a plain text array on the
 * Mission with no per-item student completion state — scoring it would mean inventing a field
 * nothing else in the schema reads or writes. Rebalanced the remaining three components to 40/40/20
 * so the score still runs 0-100 from signals this schema actually tracks; success criteria stay
 * visible to the student as a checklist to read, just not scored. AI has no vote here (§9: "AI does
 * NOT calculate authoritative readiness").
 */
export function calculateMissionReadiness(mission: MissionWithProgress, blocks: MissionBlock[], values: StudentBlockValue[]): MissionReadiness {
  const requiredBlocks = blocks.filter((b) => b.required);
  const valueByBlock = new Map(values.filter((v) => isPresent(v.value)).map((v) => [v.blockId, v.value]));
  const inputsTotal = requiredBlocks.length;
  const inputsDone = requiredBlocks.filter((b) => valueByBlock.has(b.id)).length;

  const requiredActions = mission.actions.filter((a) => a.required);
  const actionsDone = requiredActions.filter((a) => a.status === "completed").length;

  const needsEvidence = mission.completionPolicy === "evidence_required" || mission.completionPolicy === "teacher_verified";
  const hasEvidence = mission.evidence.length > 0;

  const components = [
    { weight: 40, ratio: inputsTotal ? inputsDone / inputsTotal : 1 },
    { weight: 40, ratio: requiredActions.length ? actionsDone / requiredActions.length : 1 },
    { weight: 20, ratio: needsEvidence ? (hasEvidence ? 1 : 0) : 1 }
  ];
  const score = Math.round(components.reduce((sum, c) => sum + c.weight * c.ratio, 0));
  return { score, missingRequiredBlockIds: requiredBlocks.filter((b) => !valueByBlock.has(b.id)).map((b) => b.id) };
}

export interface MissionWorkspaceView extends MissionContext {
  blocks: MissionBlock[];
  values: StudentBlockValue[];
  readiness: MissionReadiness;
}

export async function getMissionWorkspaceView(userId: string, organizationId: string, missionId: string): Promise<MissionWorkspaceView | null> {
  const context = await resolveMissionContext(userId, organizationId, missionId);
  if (!context) return null;
  const [config, values] = await Promise.all([
    getWorkspaceConfig(organizationId, context.versionId, missionId),
    getStudentBlockValues(organizationId, userId, context.versionId, missionId)
  ]);
  const blocks = (config?.blocks ?? []).slice().sort((a, b) => a.position - b.position);
  const readiness = calculateMissionReadiness(context.mission, blocks, values);
  return { ...context, blocks, values, readiness };
}

/**
 * Autosave write for one block. Re-resolves Mission access from scratch rather than trusting a
 * client-supplied journeyVersionId/locked state — the same "server derives the trust boundary"
 * rule submitEvidence/completeSelfReportedMission already follow for completion_policy. A locked
 * Mission (prerequisite not met) or a blockId that is not part of the Mission's current published
 * Workspace config is rejected before any write.
 */
export async function saveMissionBlockValue(userId: string, organizationId: string, missionId: string, blockId: string, value: unknown, status: "draft" | "saved"): Promise<Result<null>> {
  const context = await resolveMissionContext(userId, organizationId, missionId);
  if (!context) return { ok: false, error: "MISSION_NOT_ACCESSIBLE" };
  if (context.mission.displayState === "locked") return { ok: false, error: "MISSION_LOCKED" };
  const config = await getWorkspaceConfig(organizationId, context.versionId, missionId);
  if (!config || !config.blocks.some((b) => b.id === blockId)) return { ok: false, error: "BLOCK_NOT_FOUND" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("student_mission_workspace_values").upsert({
    organization_id: organizationId, student_id: userId, journey_version_id: context.versionId, mission_id: missionId,
    block_id: blockId, value: value === undefined ? null : value, status, updated_at: new Date().toISOString()
  }, { onConflict: "organization_id,student_id,journey_version_id,mission_id,block_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
