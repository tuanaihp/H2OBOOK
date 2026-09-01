// H2OBOOK Student Management & Competency V1 — types shared by the service layer, graduation
// calculator and the /instructor/classes/[classId] tabs. See supabase/migrations/0060 for the
// backing tables and docs' v6-tich-hop-them audit for why these types diverge from the reference
// package (lib/student-competency/README not needed — the migration header carries the audit).

export type SessionType = "training_makeup_hair" | "training_hair" | "practice_makeup_hair" | "practice_hair" | "extracurricular";

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  training_makeup_hair: "Training Makeup & Tóc",
  training_hair: "Training Tóc",
  practice_makeup_hair: "Thực hành Makeup & Tóc",
  practice_hair: "Thực hành Tóc",
  extracurricular: "Ngoại khóa"
};

// Curriculum defaults from the spec (§2): 60 sessions total. Used only to pre-fill the "add
// sessions" flow — classes.total_sessions is the real, editable source of truth per class.
export const CURRICULUM_DEFAULTS: { type: SessionType; count: number }[] = [
  { type: "training_makeup_hair", count: 12 },
  { type: "practice_makeup_hair", count: 20 },
  { type: "training_hair", count: 12 },
  { type: "practice_hair", count: 12 },
  { type: "extracurricular", count: 4 }
];

export interface ClassSession {
  id: string;
  classId: string;
  sessionNo: number;
  sessionType: SessionType;
  title: string;
  sessionDate: string | null;
  status: "scheduled" | "completed" | "cancelled";
}

// One rubric criterion, kept in the shape rubric_criteria (0026) already stores it in — position
// and required are read from the row, not invented here.
export interface RubricCriterionView {
  id: string;
  title: string;
  description: string;
  maxScore: number;
  position: number;
  required: boolean;
  // Which competency-profile skill this criterion feeds, if any (see SKILL_CATALOG below). Not a
  // DB column — resolved in service.ts from rubric_criteria.title so seed data stays the single
  // source of truth instead of a second mapping table.
  skillKey?: string;
}

export interface RubricView {
  id: string;
  title: string;
  category: "training" | "makeup" | "hair" | null;
  quickIssues: string[];
  updatedAt: string;
  criteria: RubricCriterionView[];
}

export interface ClassEvaluation {
  id: string;
  classSessionId: string;
  studentId: string;
  rubricId: string;
  rubricVersionLabel: string;
  totalScore: number;
  maxScore: number;
  criterionScores: Record<string, number>;
  notes: string;
  assetIds: string[];
  gradedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Student-submitted evidence for one session (migration 0063), created by the student in the
// "Khóa Makeup 60 buổi" learning-space section BEFORE the instructor grades. Separate from
// ClassEvaluation: this is the student's pre-grading upload, not a score.
export interface ClassSessionSubmission {
  classSessionId: string;
  studentId: string;
  assetIds: string[];
  note: string;
  submittedAt: string;
  updatedAt: string;
}

// One AI draft assessment of a student's session submission (migration 0065). Always a DRAFT —
// the official score is class_evaluations, which AI never writes. History is kept per analyze.
export interface ClassAiAssessment {
  id: string;
  classSessionId: string;
  studentId: string;
  provider: string;
  model: string | null;
  status: "ai_draft" | "unavailable";
  totalScore: number | null;
  maxScore: number;
  summary: string;
  priorityFixes: string[];
  criterionScores: Record<string, { score: number; maxScore: number; strength: string; issue: string; recommendation: string }>;
  rubricSnapshot: { id: string; label: string; maxScore: number; description?: string }[];
  createdAt: string;
}

// Append-only snapshots from class_evaluation_audit.  This is intentionally separate from
// ClassEvaluation (the editable current state) so a client cannot mistake a historical score for
// the current one when rendering a grading form.
export interface ClassEvaluationAuditEntry {
  id: string;
  evaluationId: string;
  action: "created" | "updated";
  changedBy: string | null;
  previousTotalScore: number | null;
  currentTotalScore: number;
  previousCriterionScores: Record<string, number> | null;
  currentCriterionScores: Record<string, number>;
  previousNotes: string | null;
  currentNotes: string;
  createdAt: string;
}

// Spec §G lists 13 tracked dimensions under "Hồ sơ năng lực". These are academy-specific
// technique skills, not the generic platform skill tree in lib/student/experience.ts
// (studentSkills) — that catalog is for the public/student Create-flow experience and has no
// overlap with makeup/hair grading criteria, so this is genuinely new catalog data, not a
// duplicate of an existing one.
export const SKILL_CATALOG: { key: string; label: string }[] = [
  { key: "foundation", label: "Nền" },
  { key: "brows", label: "Chân mày" },
  { key: "eyes", label: "Mắt" },
  { key: "lashes", label: "Mi" },
  { key: "contour", label: "Khối" },
  { key: "cheeks", label: "Má" },
  { key: "lips", label: "Môi" },
  { key: "layout", label: "Layout" },
  { key: "speed", label: "Tốc độ" },
  { key: "process", label: "Quy trình" },
  { key: "training_discipline", label: "Kỷ luật Training" },
  { key: "hair_skills", label: "Kỹ năng Tóc" },
  { key: "study_record", label: "Hồ sơ học tập" }
];

export interface GraduationInput {
  evaluations: { totalScore: number; maxScore: number }[];
  requiredCriteriaMet: boolean;
  evidenceComplete: boolean;
  finalAssessmentPassed: boolean;
  courseCompleted?: boolean;
  supplementSessionsConfig?: number;
}

export type GraduationRequirement = "passing_evaluation_ratio" | "required_criteria" | "course_completion" | "evidence_profile" | "final_assessment";

export interface GraduationResult {
  passingEvaluationRatio: number;
  avgScore: number;
  evaluationCount: number;
  missingRequirements: GraduationRequirement[];
  graduationStatus: "graduated" | "not_ready";
  recommendedSupplementSessions: number;
}

export interface CompetencySkillPoint {
  key: string;
  label: string;
  latestScore: number | null;
  trend30: number | null;
  trend60: number | null;
  trend90: number | null;
  evidenceCount: number;
  weakEvidenceCount: number;
}
