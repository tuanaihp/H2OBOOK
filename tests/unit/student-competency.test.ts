import { describe, expect, it } from "vitest";
import { aggregateCompetencyProfile, estimateClientReadiness } from "@/lib/student-competency/competency";
import { calculateGraduationStatus } from "@/lib/student-competency/graduation";

describe("student competency rules", () => {
  it("requires every graduation condition and recommends the configured supplement range", () => {
    const result = calculateGraduationStatus({
      evaluations: [{ totalScore: 90, maxScore: 100 }, { totalScore: 80, maxScore: 100 }],
      requiredCriteriaMet: true,
      courseCompleted: true,
      evidenceComplete: true,
      finalAssessmentPassed: true,
      supplementSessionsConfig: 25
    });

    expect(result.graduationStatus).toBe("graduated");
    expect(result.passingEvaluationRatio).toBe(0.5);
    expect(result.recommendedSupplementSessions).toBe(0);

    const notReady = calculateGraduationStatus({
      evaluations: [{ totalScore: 80, maxScore: 100 }],
      requiredCriteriaMet: false,
      courseCompleted: false,
      evidenceComplete: false,
      finalAssessmentPassed: false,
      supplementSessionsConfig: 25
    });
    expect(notReady.graduationStatus).toBe("not_ready");
    expect(notReady.missingRequirements).toContain("course_completion");
    expect(notReady.recommendedSupplementSessions).toBe(15);
  });

  it("aggregates the latest skill score and produces an explainable readiness result", () => {
    const now = new Date("2026-08-28T12:00:00.000Z").getTime();
    const profile = aggregateCompetencyProfile([
      { skillKey: "foundation", score: 70, occurredAt: "2026-08-01T12:00:00.000Z" },
      { skillKey: "foundation", score: 90, occurredAt: "2026-08-25T12:00:00.000Z" },
      { skillKey: "brows", score: 88, occurredAt: "2026-08-25T12:00:00.000Z" }
    ], now);

    expect(profile.find((skill) => skill.key === "foundation")).toMatchObject({ latestScore: 90, trend30: 80, evidenceCount: 2, weakEvidenceCount: 0 });
    expect(estimateClientReadiness(profile)).toBe("san_sang");
  });
});
