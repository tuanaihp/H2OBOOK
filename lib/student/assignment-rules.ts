// Assignment shapes and the rules that act on them. Deliberately free of any server import so the
// state machine can be tested directly and shared with client components — lib/student/assignments.ts
// is "server-only" because it touches the database, and importing that from a test or a page would
// drag the whole data layer along with it.

export type SubmissionStatus = "draft" | "submitted" | "in_review" | "revision_requested" | "graded";

export interface CriterionScore { criterionId: string; score: number; maxScore: number; required: boolean }

export interface RubricCriterion { id: string; title: string; description: string; maxScore: number; position: number }

export interface SubmissionAttempt {
  id: string;
  status: SubmissionStatus;
  textResponse: string;
  assetIds: string[];
  score: number | null;
  instructorFeedback: string | null;
  criterionScores: CriterionScore[];
  portfolioReady: boolean;
  submittedAt: string | null;
  gradedAt: string | null;
  createdAt: string;
}

export interface StudentAssignment {
  id: string;
  title: string;
  instructions: string;
  submissionTypes: string[];
  maxScore: number;
  passingScore: number;
  allowResubmission: boolean;
  criteria: RubricCriterion[];
  /** Newest first. The first entry is the one the rules below judge. */
  attempts: SubmissionAttempt[];
}

/**
 * Whether the next move is the student's. Enforced on the server before every insert; the page
 * mirrors it only so it does not offer a button that would be refused.
 *
 * submitted and in_review are waiting on the instructor — a second attempt there would create two
 * live submissions for one piece of work and there is no rule for which one gets graded. graded is
 * finished; reopening it is the instructor's call, expressed by asking for a revision.
 */
export function canSubmit(assignment: StudentAssignment): boolean {
  const latest = assignment.attempts[0];
  if (!latest) return true;
  if (latest.status === "draft") return true;
  if (latest.status === "revision_requested") return assignment.allowResubmission;
  return false;
}

export function statusLabel(status: SubmissionStatus | "not_started"): string {
  switch (status) {
    case "not_started": return "Chưa nộp";
    case "draft": return "Bản nháp";
    case "submitted": return "Đã nộp — chờ duyệt";
    case "in_review": return "Giảng viên đang chấm";
    case "revision_requested": return "Cần chỉnh sửa và nộp lại";
    case "graded": return "Đã chấm";
  }
}
