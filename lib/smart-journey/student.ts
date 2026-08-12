import "server-only";
import { getJourneyForStudent } from "@/lib/learn-outcome/student";
import type { MissionWithProgress } from "@/lib/learn-outcome/student";
import { loadCareerStages } from "@/lib/career-stages/service";
import { stageDisplayRank } from "@/lib/career-stages/types";
import { getWorkspaceConfigsForVersion, getStudentBlockValuesForVersion } from "@/lib/mission-workspace/service";
import { calculateMissionReadiness } from "@/lib/mission-workspace/student";
import { listBlueprintVersions, loadBlueprintForStage } from "@/lib/learn-outcome/service";
import type { JourneyMissionSummary, JourneyOutcomeSummary, JourneyTodayItem, SmartJourneyReadModel } from "./types";

const DONE_STATES = new Set(["verified", "result_achieved"]);

function toSummary(mission: MissionWithProgress, isCurrent: boolean, readinessScore: number | null): JourneyMissionSummary {
  return {
    id: mission.id, title: mission.title, description: mission.description,
    state: mission.displayState, progressPercent: DONE_STATES.has(mission.displayState) ? 100 : mission.displayState === "locked" ? 0 : mission.actions.length ? Math.round((mission.actions.filter((a) => a.status === "completed").length / mission.actions.length) * 100) : 0,
    readinessScore, lockedReason: mission.lockedReason, estimatedDays: mission.estimatedDays, isCurrent,
    blockers: mission.lockedReason ? [mission.lockedReason] : [],
    resultSummary: mission.resultAchievedAt ? { status: "achieved", title: mission.title }
      : mission.verifiedAt ? { status: "verified", title: mission.title }
      : mission.evidenceSubmittedAt ? { status: "submitted", title: mission.title }
      : null
  };
}

/**
 * The single read model behind Map/Roadmap/Danh sách/Today (docs/smart-journey-v3 §4). Every view
 * renders from this — the same shape is what makes mandatory tests #1-#3 ("same mission ids /
 * current mission / locked reason across views") true by construction rather than by convention.
 *
 * Readiness for every mission is computed here in two batched queries for the whole Journey
 * version (getWorkspaceConfigsForVersion / getStudentBlockValuesForVersion), not one query per
 * mission — §12/§14 "no N+1", the same reasoning as lib/learn-outcome/admin.ts's preflight.
 */
export async function getSmartJourneyReadModel(userId: string, organizationId: string, stageId: string): Promise<SmartJourneyReadModel | null> {
  const [journey, blueprint, stages] = await Promise.all([
    getJourneyForStudent(userId, organizationId, stageId),
    loadBlueprintForStage(organizationId, stageId),
    loadCareerStages(organizationId)
  ]);
  if (!journey?.versionId || !blueprint) return null;
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return null;

  const [configs, values, versions] = await Promise.all([
    getWorkspaceConfigsForVersion(organizationId, journey.versionId),
    getStudentBlockValuesForVersion(organizationId, userId, journey.versionId),
    listBlueprintVersions(organizationId, blueprint.id)
  ]);
  const versionNumber = versions.find((v) => v.id === journey.versionId)?.versionNumber ?? 1;

  const allMissions = journey.outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions));
  const currentMission = allMissions.find((m) => !DONE_STATES.has(m.displayState) && m.displayState !== "locked") ?? null;

  const readinessByMission = new Map<string, number>();
  for (const mission of allMissions) {
    if (mission.displayState === "locked") continue;
    const config = configs.get(mission.id);
    const readiness = calculateMissionReadiness(mission, config?.blocks ?? [], values.get(mission.id) ?? []);
    readinessByMission.set(mission.id, readiness.score);
  }

  const outcomes: JourneyOutcomeSummary[] = journey.outcomes.map((outcome, index) => {
    const outcomeMissions = outcome.milestones.flatMap((m) => m.missions);
    const achieved = outcomeMissions.filter((m) => DONE_STATES.has(m.displayState)).length;
    return {
      id: outcome.id, title: outcome.title, position: index,
      progressPercent: outcomeMissions.length ? Math.round((achieved / outcomeMissions.length) * 100) : 0,
      expectedResult: outcome.description || null,
      milestones: outcome.milestones.map((milestone, milestoneIndex) => ({
        id: milestone.id, title: milestone.title, position: milestoneIndex,
        missions: milestone.missions.map((mission) => toSummary(mission, mission.id === currentMission?.id, readinessByMission.get(mission.id) ?? null))
      }))
    };
  });

  const counts = {
    total: allMissions.length,
    doing: allMissions.filter((m) => ["doing", "learning", "planning"].includes(m.displayState)).length,
    completed: allMissions.filter((m) => DONE_STATES.has(m.displayState)).length,
    evidencePending: allMissions.filter((m) => ["evidence_pending", "review_pending"].includes(m.displayState)).length,
    locked: allMissions.filter((m) => m.displayState === "locked").length
  };

  // Journey-level readiness is the current mission's readiness — the same number the Mission
  // Workspace strip shows, not a separate blended metric that could disagree with it. 100 once
  // the stage has no mission left to work on, matching "fully ready, nothing pending" rather than
  // an empty/undefined state.
  const readinessScore = currentMission ? (readinessByMission.get(currentMission.id) ?? 0) : 100;

  const todayItems = buildTodayItems(allMissions, currentMission);

  return {
    organizationId, studentId: userId, stageId, stageTitle: stage.title, stagePosition: stageDisplayRank(stages, stageId),
    journeyBlueprintId: blueprint.id, journeyVersionId: journey.versionId, journeyVersionNumber: versionNumber, blueprintTitle: journey.blueprintTitle,
    progressPercent: journey.progressPercent, readinessScore, currentMissionId: currentMission?.id ?? null,
    // Never fabricated (mandatory test #13 "no fake ETA") — null until Release 4's H2O Journey AI
    // produces a real forecast; the UI shows "—" for null rather than guessing a date.
    predictedFinishDate: null,
    outcomes, todayItems,
    ai: { status: "unavailable", insight: null, nextBestMissionId: null, nextBestAction: null, blocker: null, adaptivePath: null, predictedFinishDate: null, confidence: null, signals: [] },
    counts
  };
}

/**
 * Deterministic Today list (§9: "deterministic current/open/due actions first; AI chỉ
 * enrich/rerank" — enrich step is Release 4, not built, so this is the whole list for now). Picks
 * up to 5 real, actionable items: starting the current mission, its open required actions, then
 * evidence/review nudges for any other in-progress mission — never invented busywork.
 */
function buildTodayItems(allMissions: MissionWithProgress[], currentMission: MissionWithProgress | null): JourneyTodayItem[] {
  const items: JourneyTodayItem[] = [];
  if (currentMission) {
    if (!currentMission.actions.length) {
      items.push({ id: `start-${currentMission.id}`, missionId: currentMission.id, title: `Bắt đầu: ${currentMission.title}`, reason: "Mission hiện tại của bạn", estimatedDays: currentMission.estimatedDays, priority: 0 });
    } else {
      for (const action of currentMission.actions.filter((a) => a.required && a.status !== "completed" && a.status !== "skipped")) {
        items.push({ id: action.id, missionId: currentMission.id, title: action.title, reason: currentMission.title, estimatedDays: null, priority: 1 });
      }
      if (currentMission.displayState === "evidence_pending" || (!currentMission.actions.some((a) => a.required && a.status !== "completed") && currentMission.completionPolicy !== "self_reported" && currentMission.completionPolicy !== "metric_based" && !currentMission.evidenceSubmittedAt)) {
        items.push({ id: `evidence-${currentMission.id}`, missionId: currentMission.id, title: `Nộp Evidence: ${currentMission.title}`, reason: "Đã hoàn thành các bước, cần nộp bằng chứng", estimatedDays: null, priority: 1 });
      }
    }
  }
  for (const mission of allMissions) {
    if (items.length >= 5) break;
    if (mission.id === currentMission?.id) continue;
    if (mission.displayState === "review_pending") items.push({ id: `review-${mission.id}`, missionId: mission.id, title: `Đang chờ giáo viên duyệt: ${mission.title}`, reason: "Chưa cần hành động thêm, theo dõi kết quả", estimatedDays: null, priority: 2 });
  }
  return items.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
