// Learn Outcome OS V1 — the execution/outcome graph (Outcome -> Milestone -> Mission -> Action ->
// Evidence -> Result) that sits alongside the curriculum graph (career_stages -> academy_stage_nodes
// -> career_stage_resources). See docs/learn-outcome-os/01_CURRENT_LEARN_AUDIT.md for why this is
// additive, not a replacement, and supabase/migrations/0050_h2obook_learn_outcome_os_v1.sql for the
// schema these map to 1:1.

export type BlueprintVersionStatus = "draft" | "published" | "archived";
export type MissionCompletionPolicy = "evidence_required" | "teacher_verified" | "metric_based" | "self_reported";
export type MissionBindingRole = "required" | "recommended";
export type StudentMissionState =
  | "not_started" | "learning" | "planning" | "doing" | "evidence_pending"
  | "review_pending" | "verified" | "result_achieved" | "blocked";
export type StudentActionStatus = "planned" | "doing" | "completed" | "skipped";
export type StudentActionSourceType = "mission_template" | "assignment" | "personal_plan" | "tool_generated" | "mentor_suggestion";

export interface JourneyBlueprint {
  id: string;
  stageId: string;
  title: string;
  currentPublishedVersionId: string | null;
}

export interface JourneyBlueprintVersion {
  id: string;
  blueprintId: string;
  versionNumber: number;
  status: BlueprintVersionStatus;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface JourneyOutcome {
  id: string;
  versionId: string;
  title: string;
  description: string;
  position: number;
  milestones: JourneyMilestone[];
}

export interface JourneyMilestone {
  id: string;
  outcomeId: string;
  title: string;
  description: string;
  position: number;
  missions: JourneyMission[];
}

export interface JourneyMission {
  id: string;
  /** Self-referencing identity anchor that survives cloning (migration 0054) — see lib/learn-outcome/admin.ts's publishVersion for why this exists: without it, publishing a new version over an already-published one would silently orphan real students' progress. */
  rootMissionId: string | null;
  milestoneId: string;
  title: string;
  description: string;
  expectedResult: string;
  estimatedDays: number | null;
  prerequisiteMissionId: string | null;
  completionPolicy: MissionCompletionPolicy;
  successCriteria: string[];
  evidencePolicy: Record<string, unknown>;
  position: number;
  resourceBindings: MissionResourceBinding[];
  toolBindings: MissionToolBinding[];
  assignmentBindings: MissionAssignmentBinding[];
  actionTemplates: MissionActionTemplate[];
}

export interface MissionResourceBinding { id: string; missionId: string; resourceType: string; resourceId: string; role: MissionBindingRole; position: number }
export interface MissionToolBinding { id: string; missionId: string; toolType: string; toolId: string; role: MissionBindingRole; position: number }
export interface MissionAssignmentBinding { id: string; missionId: string; assignmentId: string; role: MissionBindingRole; position: number }
export interface MissionActionTemplate { id: string; missionId: string; title: string; description: string; required: boolean; dayOffset: number | null; evidenceRequired: boolean; position: number }

export interface MissionInput {
  title: string;
  description?: string;
  expectedResult: string;
  estimatedDays?: number | null;
  prerequisiteMissionId?: string | null;
  completionPolicy?: MissionCompletionPolicy;
  successCriteria?: string[];
  evidencePolicy?: Record<string, unknown>;
  position?: number;
}

export type PreflightCategory = "structure" | "missing_kpi" | "missing_duration" | "missing_binding" | "circular" | "broken_reference" | "other";
export interface PreflightFinding { severity: "blocker" | "warning"; category: PreflightCategory; missionId: string | null; missionTitle: string | null; message: string }

export interface PreflightResult {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  /** Same findings as blockers/warnings, structured for the V2 UI's group-and-filter view (docs/journey-v2 §10) instead of a flat dump. */
  findings: PreflightFinding[];
}
