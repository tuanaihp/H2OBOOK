// H2OBOOK Teaching Intelligence Center V1 (adapted from
// v5/12-h2obook-teaching-intelligence-center-v1/src/core/types.ts). The source module models 6
// teaching roles (mentor/instructor/reviewer/training_manager/admin/owner) backed by a dedicated
// role-assignment table. This repo's real role system (public.member_role, see
// lib/auth/current-user.ts) only has 'teacher' for anyone who teaches — there is no DB-backed
// mentor/reviewer/training_manager distinction yet. TeachingRole is kept narrow to what the
// database can actually attest today; the richer roles stay as a documented future extension
// (see docs/H2OBOOK-TEACHING-INTELLIGENCE-CENTER-V1-INTEGRATION-REPORT.md).
export type TeachingRole = "teacher" | "admin" | "owner";

export interface TeachingAccessSnapshot {
  userId: string;
  organizationId: string;
  role: TeachingRole;
  assignedClassIds: string[];
  assignedStudentIds: string[];
  canViewAllStudents: boolean;
  canViewAllClasses: boolean;
}

export type StudentRiskFlag =
  | "inactive"
  | "low_progress"
  | "overdue_assignments"
  | "repeated_revision"
  | "waiting_feedback"
  | "low_mastery";

export type RiskSeverity = "healthy" | "watch" | "attention" | "critical";

export interface StudentSignals {
  studentId: string;
  daysInactive: number;
  progressPercent: number;
  overdueAssignments: number;
  repeatedRevisionCount: number;
  feedbackWaitHours: number;
  masteryPercent: number;
}

export interface StudentRiskAssessment {
  studentId: string;
  score: number;
  severity: RiskSeverity;
  flags: StudentRiskFlag[];
  recommendedActions: string[];
}

export type TeachingTaskKind =
  | "grade_submission"
  | "student_intervention"
  | "approve_portfolio";

export interface TeachingTask {
  id: string;
  kind: TeachingTaskKind;
  title: string;
  dueAt?: string;
  waitingHours?: number;
  riskSeverity?: RiskSeverity;
  studentId?: string;
  classId?: string;
  sourceId?: string;
}

export interface RankedTeachingTask extends TeachingTask {
  priorityScore: number;
  priorityLabel: "low" | "normal" | "high" | "urgent";
}

export type SubmissionDecision = "needs_revision" | "passed" | "portfolio_ready";

export interface RubricCriterionScore {
  criterionId: string;
  score: number;
  maxScore: number;
  required: boolean;
}

export interface FeedbackReadinessInput {
  criteria: RubricCriterionScore[];
  hasWrittenFeedback: boolean;
  hasSkillEvidence: boolean;
  learnerReflectionComplete: boolean;
}

export interface FeedbackReadinessResult {
  scorePercent: number;
  decision: SubmissionDecision;
  blockingReasons: string[];
  canPublishEvidence: boolean;
}
