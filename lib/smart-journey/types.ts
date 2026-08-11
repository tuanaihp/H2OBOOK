// Smart Journey Shell V3 — one read model shared by Map/Roadmap/Danh sách/Today, matching
// v5/31-H2OBOOK_SMART_JOURNEY_SHELL_V3/src/smart-journey/types/index.ts. Reuses
// MissionDisplayState (lib/learn-outcome/student.ts) rather than redefining an equivalent union —
// the source package's own JourneyMissionState is that same set of values.
import "server-only";
import type { MissionDisplayState } from "@/lib/learn-outcome/student";

export type JourneyPrimaryMode = "journey" | "today";
export type JourneyViewMode = "map" | "roadmap" | "list";
export type MissionListMode = "grouped" | "queue";

export interface JourneyMissionSummary {
  id: string; title: string; description: string;
  state: MissionDisplayState; progressPercent: number;
  readinessScore: number | null; lockedReason: string | null;
  estimatedDays: number | null; isCurrent: boolean;
  blockers: string[];
  resultSummary: { status: "none" | "submitted" | "verified" | "achieved"; title: string | null } | null;
}
export interface JourneyMilestoneSummary { id: string; title: string; position: number; missions: JourneyMissionSummary[] }
export interface JourneyOutcomeSummary { id: string; title: string; position: number; progressPercent: number; expectedResult: string | null; milestones: JourneyMilestoneSummary[] }
export interface JourneyTodayItem { id: string; missionId: string; title: string; reason: string | null; estimatedDays: number | null; priority: number }

/** Always "unavailable" today — H2O Journey AI is Release 4, not built. Field kept so the shell and its consumers already have the right shape when it lands, instead of a second migration later. */
export interface JourneyAiSnapshot { status: "ready" | "disabled" | "unavailable"; insight: string | null; nextBestMissionId: string | null; nextBestAction: string | null; blocker: string | null; adaptivePath: string | null; predictedFinishDate: string | null; confidence: number | null; signals: string[] }

export interface SmartJourneyReadModel {
  organizationId: string; studentId: string; stageId: string; stageTitle: string; stagePosition: number;
  journeyBlueprintId: string; journeyVersionId: string; journeyVersionNumber: number; blueprintTitle: string | null;
  progressPercent: number; readinessScore: number;
  currentMissionId: string | null; predictedFinishDate: string | null;
  outcomes: JourneyOutcomeSummary[]; todayItems: JourneyTodayItem[]; ai: JourneyAiSnapshot;
  counts: { total: number; doing: number; completed: number; evidencePending: number; locked: number };
}
