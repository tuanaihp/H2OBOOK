// Pure rubric readiness scoring — ported as-is from
// v5/12-h2obook-teaching-intelligence-center-v1/src/core/feedback.ts. A portfolio-ready decision
// still requires an explicit instructor confirmation in the API layer (lib/teaching/grading.ts) —
// this function can compute that a submission is eligible, it can never itself finalize it.
import type { FeedbackReadinessInput, FeedbackReadinessResult, SubmissionDecision } from "./types";

export function evaluateFeedbackReadiness(input: FeedbackReadinessInput): FeedbackReadinessResult {
  const blockingReasons: string[] = [];
  const totalMax = input.criteria.reduce((sum, c) => sum + c.maxScore, 0);
  const totalScore = input.criteria.reduce((sum, c) => sum + c.score, 0);
  const scorePercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  for (const criterion of input.criteria) {
    if (criterion.required && criterion.maxScore > 0 && criterion.score / criterion.maxScore < 0.6) {
      blockingReasons.push(`Tiêu chí bắt buộc "${criterion.criterionId}" chưa đạt 60%.`);
    }
  }
  if (!input.hasWrittenFeedback) blockingReasons.push("Chưa có phản hồi bằng văn bản cho học viên.");
  if (!input.hasSkillEvidence) blockingReasons.push("Chưa ghi nhận bằng chứng kỹ năng.");
  if (!input.learnerReflectionComplete) blockingReasons.push("Học viên chưa hoàn thành phần tự đánh giá.");

  let decision: SubmissionDecision = "needs_revision";
  if (scorePercent >= 85 && blockingReasons.length === 0) decision = "portfolio_ready";
  else if (scorePercent >= 70 && input.hasWrittenFeedback) decision = "passed";

  return {
    scorePercent,
    decision,
    blockingReasons,
    canPublishEvidence: decision === "portfolio_ready"
  };
}
