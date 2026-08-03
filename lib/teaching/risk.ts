// Pure Risk Radar scoring — ported as-is from
// v5/12-h2obook-teaching-intelligence-center-v1/src/core/risk.ts.
import type { RiskSeverity, StudentRiskAssessment, StudentRiskFlag, StudentSignals } from "./types";

function severityFromScore(score: number): RiskSeverity {
  if (score >= 80) return "critical";
  if (score >= 55) return "attention";
  if (score >= 25) return "watch";
  return "healthy";
}

export function assessStudentRisk(signals: StudentSignals): StudentRiskAssessment {
  let score = 0;
  const flags: StudentRiskFlag[] = [];
  const actions: string[] = [];

  if (signals.daysInactive >= 7) {
    flags.push("inactive");
    score += Math.min(30, 16 + (signals.daysInactive - 7) * 2);
    actions.push("Gửi tin nhắn hỏi thăm và tạo nhiệm vụ quay lại học trong 15 phút.");
  }

  if (signals.progressPercent < 40) {
    flags.push("low_progress");
    score += 18;
    actions.push("Rút gọn mục tiêu tuần và giao một nhiệm vụ ưu tiên duy nhất.");
  }

  if (signals.overdueAssignments > 0) {
    flags.push("overdue_assignments");
    score += Math.min(24, signals.overdueAssignments * 8);
    actions.push("Xác nhận nguyên nhân quá hạn và đặt lại deadline có cam kết.");
  }

  if (signals.repeatedRevisionCount >= 2) {
    flags.push("repeated_revision");
    score += Math.min(18, signals.repeatedRevisionCount * 5);
    actions.push("Giao bài học bổ sung đúng lỗi đang lặp lại và hẹn phản hồi ngắn.");
  }

  if (signals.feedbackWaitHours >= 48) {
    flags.push("waiting_feedback");
    score += 16;
    actions.push("Ưu tiên phản hồi bài nộp đang chờ quá 48 giờ.");
  }

  if (signals.masteryPercent < 50) {
    flags.push("low_mastery");
    score += 14;
    actions.push("Mở lại flashcard, bài học nguồn và một bài thực hành ngắn.");
  }

  const normalizedScore = Math.min(100, score);
  return {
    studentId: signals.studentId,
    score: normalizedScore,
    severity: severityFromScore(normalizedScore),
    flags,
    recommendedActions: actions
  };
}
