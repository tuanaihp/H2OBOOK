import type { GraduationInput, GraduationResult, GraduationRequirement } from "./types";

// Pure formula from spec §F ("Điều kiện tốt nghiệp"). Kept side-effect free and Supabase-free so
// it can be unit tested directly and reused identically by the API route and any future report.
const DEFAULT_SUPPLEMENT_SESSIONS = 10;
const MIN_SUPPLEMENT_SESSIONS = 5;
const MAX_SUPPLEMENT_SESSIONS = 15;
const PASSING_SCORE_THRESHOLD = 90;
const MIN_PASSING_EVALUATION_RATIO = 0.5;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampSupplementSessions(value: number | undefined): number {
  const raw = value ?? DEFAULT_SUPPLEMENT_SESSIONS;
  return Math.min(MAX_SUPPLEMENT_SESSIONS, Math.max(MIN_SUPPLEMENT_SESSIONS, Math.round(raw)));
}

export function calculateGraduationStatus(input: GraduationInput): GraduationResult {
  const percentScores = input.evaluations
    .filter((row) => row.maxScore > 0)
    .map((row) => (row.totalScore / row.maxScore) * 100);

  const evaluationCount = percentScores.length;
  const avgScore = evaluationCount ? round2(percentScores.reduce((sum, v) => sum + v, 0) / evaluationCount) : 0;
  const passingCount = percentScores.filter((score) => score >= PASSING_SCORE_THRESHOLD).length;
  const passingEvaluationRatio = evaluationCount ? round2(passingCount / evaluationCount) : 0;

  const missingRequirements: GraduationRequirement[] = [];
  if (evaluationCount === 0 || passingEvaluationRatio < MIN_PASSING_EVALUATION_RATIO) missingRequirements.push("passing_evaluation_ratio");
  if (!input.requiredCriteriaMet) missingRequirements.push("required_criteria");
  if (input.courseCompleted === false) missingRequirements.push("course_completion");
  if (!input.evidenceComplete) missingRequirements.push("evidence_profile");
  if (!input.finalAssessmentPassed) missingRequirements.push("final_assessment");

  const graduationStatus: GraduationResult["graduationStatus"] = missingRequirements.length === 0 ? "graduated" : "not_ready";

  return {
    passingEvaluationRatio,
    avgScore,
    evaluationCount,
    missingRequirements,
    graduationStatus,
    recommendedSupplementSessions: graduationStatus === "graduated" ? 0 : clampSupplementSessions(input.supplementSessionsConfig)
  };
}

export const GRADUATION_REQUIREMENT_LABEL: Record<GraduationRequirement, string> = {
  passing_evaluation_ratio: "Chưa đạt tối thiểu 50% số lần đánh giá ≥ 90/100",
  required_criteria: "Chưa hoàn thành đầy đủ tiêu chí bắt buộc",
  course_completion: "Chưa hoàn thành đầy đủ khung buổi học của lớp",
  evidence_profile: "Hồ sơ ảnh/video/ghi chép chưa đầy đủ",
  final_assessment: "Chưa đạt đánh giá cuối khóa"
};
