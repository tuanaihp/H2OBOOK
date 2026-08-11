// Client-side mirror of lib/smart-journey/types.ts's SmartJourneyReadModel — duplicated rather than
// imported (that module is server-only) the same way components/student/journey-map.tsx and
// mission-workspace-client.tsx already mirror their server read models locally.
export type MissionState = "locked" | "available" | "not_started" | "learning" | "planning" | "doing" | "evidence_pending" | "review_pending" | "verified" | "result_achieved" | "blocked";
export type PrimaryMode = "journey" | "today";
export type ViewMode = "map" | "roadmap" | "list";
export type ListMode = "grouped" | "queue";

export type MissionSummary = {
  id: string; title: string; description: string; state: MissionState; progressPercent: number;
  readinessScore: number | null; lockedReason: string | null; estimatedDays: number | null; isCurrent: boolean;
  blockers: string[]; resultSummary: { status: string; title: string | null } | null;
};
export type MilestoneSummary = { id: string; title: string; position: number; missions: MissionSummary[] };
export type OutcomeSummary = { id: string; title: string; position: number; progressPercent: number; expectedResult: string | null; milestones: MilestoneSummary[] };
export type TodayItem = { id: string; missionId: string; title: string; reason: string | null; estimatedDays: number | null; priority: number };
export type AiSnapshot = { status: "ready" | "disabled" | "unavailable"; insight: string | null; nextBestMissionId: string | null; nextBestAction: string | null; blocker: string | null; adaptivePath: string | null; predictedFinishDate: string | null; confidence: number | null; signals: string[] };

export type SmartJourneyModel = {
  organizationId: string; studentId: string; stageId: string; stageTitle: string; stagePosition: number;
  journeyBlueprintId: string; journeyVersionId: string; journeyVersionNumber: number; blueprintTitle: string | null;
  progressPercent: number; readinessScore: number; currentMissionId: string | null; predictedFinishDate: string | null;
  outcomes: OutcomeSummary[]; todayItems: TodayItem[]; ai: AiSnapshot;
  counts: { total: number; doing: number; completed: number; evidencePending: number; locked: number };
};

export const STATE_LABEL: Record<MissionState, string> = {
  locked: "Khóa", available: "Sẵn sàng", not_started: "Sẵn sàng", learning: "Đang học",
  planning: "Đang lên kế hoạch", doing: "Đang làm", evidence_pending: "Cần Evidence",
  review_pending: "Chờ giáo viên duyệt", verified: "Đã xác nhận", result_achieved: "Đạt kết quả", blocked: "Bị nghẽn"
};

export function flattenMissions(model: SmartJourneyModel) {
  return model.outcomes.flatMap((outcome) => outcome.milestones.flatMap((milestone) => milestone.missions.map((mission) => ({ outcome, milestone, mission }))));
}
export function actionLabel(m: MissionSummary): string {
  if (m.state === "locked") return "Đang khóa";
  if (m.state === "verified" || m.state === "result_achieved") return "Xem kết quả";
  if (m.state === "evidence_pending") return "Nộp Evidence";
  return "Mở Workspace";
}
/** High/medium/low priority ordering without real AI (Release 4 not built): in-progress work first, then ready-to-start, done last. */
function heuristicPriority(m: MissionSummary): number {
  if (["doing", "learning", "planning", "evidence_pending", "review_pending"].includes(m.state)) return 0;
  if (m.state === "available" || m.state === "not_started") return 1;
  return 2;
}
export function fireJourneyEvent(eventName: string, missionId?: string, payload?: Record<string, unknown>) {
  fetch("/api/student/smart-journey/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName, missionId, payload }) }).catch(() => {});
}

export function buildActionQueue(model: SmartJourneyModel) {
  return flattenMissions(model)
    .filter((x) => !["locked", "result_achieved", "verified"].includes(x.mission.state))
    .sort((a, b) => heuristicPriority(a.mission) - heuristicPriority(b.mission) || (b.mission.readinessScore ?? 0) - (a.mission.readinessScore ?? 0));
}
