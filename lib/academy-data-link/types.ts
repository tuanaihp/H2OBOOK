// Academy Data Link V1 — types for the read-model that links Curriculum (career_stages ->
// academy_stage_nodes -> career_stage_resources) to the Journey/Outcome graph
// (learning_journey_* -> learning_mission_resource_bindings) to what a student actually sees.
// Everything here is derived at read time from existing tables — see docs/academy-data-link-v1/
// 01_PRODUCTION_AUDIT.md for why no new source-of-truth table was added.

export type SetupStepState = "not_started" | "in_progress" | "complete" | "warning";

export interface AcademySetupStep {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  title: string;
  description: string;
  state: SetupStepState;
  helper?: string | null;
  actionLabel: string;
  actionHref: string;
}

export interface CurriculumPlacement {
  stageId: string;
  stageTitle: string;
  stagePosition: number;
  nodeId?: string | null;
  programTitle?: string | null;
  moduleTitle?: string | null;
  groupTitle?: string | null;
}

export interface MissionUsage {
  journeyVersionId: string;
  missionId: string;
  missionTitle: string;
  outcomeTitle?: string | null;
  milestoneTitle?: string | null;
  bindingRole: string;
  published: boolean;
}

export interface StudentSurfaceUsage {
  surface: string;
  visible: boolean;
  accessState: "open" | "locked" | "conditional";
  reason?: string | null;
}

export interface AcademyDataLinkResource {
  resourceType: string;
  resourceId: string;
  title: string;
  curriculumPlacements: CurriculumPlacement[];
  missionUsages: MissionUsage[];
  studentSurfaces: StudentSurfaceUsage[];
}

export interface StageLinkHealth {
  stageId: string;
  stageTitle: string;
  stagePosition: number;
  curriculumNodeCount: number;
  curriculumResourceCount: number;
  journeyVersionCount: number;
  publishedJourney: boolean;
  missionCount: number;
  missionsWithResources: number;
  missionsMissingSuccessCriteria: number;
  brokenResourceBindings: number;
  studentSurfaceErrors: number;
  score: number;
  warnings: string[];
}

export interface StudentStageContextCheck {
  studentId: string;
  studentName: string;
  assignedStageId: string;
  assignedStageTitle: string;
  assignedStagePosition: number;
  resolvedStageId: string;
  resolvedStagePosition: number;
  journeyStageId: string | null;
  journeyStagePosition: number | null;
  isConsistent: boolean;
  issues: string[];
}
