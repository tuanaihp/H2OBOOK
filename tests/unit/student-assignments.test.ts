import { describe, expect, it } from "vitest";
import { canSubmit, statusLabel, type StudentAssignment, type SubmissionAttempt, type SubmissionStatus } from "@/lib/student/assignment-rules";

// canSubmit is what stands between a student and a duplicate submission while an instructor is
// still grading. It is a pure function so the state machine can be pinned without a database; the
// server calls it before every insert, and the page mirrors it only to avoid offering a button
// that would be refused.

function attempt(status: SubmissionStatus, overrides: Partial<SubmissionAttempt> = {}): SubmissionAttempt {
  return {
    id: `a-${status}`,
    status,
    textResponse: "",
    assetIds: [],
    score: null,
    instructorFeedback: null,
    criterionScores: [],
    portfolioReady: false,
    submittedAt: null,
    gradedAt: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    ...overrides
  };
}

function assignment(attempts: SubmissionAttempt[], allowResubmission = true): StudentAssignment {
  return {
    id: "assignment-1",
    title: "Nền cô dâu trong trẻo",
    instructions: "",
    submissionTypes: ["text"],
    maxScore: 100,
    passingScore: 70,
    allowResubmission,
    criteria: [],
    attempts
  };
}

describe("canSubmit", () => {
  it("lets a student start when nothing has been submitted", () => {
    expect(canSubmit(assignment([]))).toBe(true);
  });

  it("lets a student finish a draft", () => {
    expect(canSubmit(assignment([attempt("draft")]))).toBe(true);
  });

  it("blocks a second submission while the instructor still has it", () => {
    expect(canSubmit(assignment([attempt("submitted")]))).toBe(false);
    expect(canSubmit(assignment([attempt("in_review")]))).toBe(false);
  });

  it("blocks resubmission once the work has been graded", () => {
    expect(canSubmit(assignment([attempt("graded")]))).toBe(false);
  });

  it("opens resubmission only when revision was requested and the assignment allows it", () => {
    expect(canSubmit(assignment([attempt("revision_requested")], true))).toBe(true);
    expect(canSubmit(assignment([attempt("revision_requested")], false))).toBe(false);
  });

  it("judges by the newest attempt, not the oldest", () => {
    // The service returns attempts newest first; an earlier revision_requested must not reopen an
    // assignment whose latest attempt is back with the instructor.
    const attempts = [attempt("submitted", { id: "new" }), attempt("revision_requested", { id: "old" })];
    expect(canSubmit(assignment(attempts))).toBe(false);
  });
});

describe("statusLabel", () => {
  it("names every state a submission can be in", () => {
    const states: (SubmissionStatus | "not_started")[] = ["not_started", "draft", "submitted", "in_review", "revision_requested", "graded"];
    for (const state of states) {
      expect(statusLabel(state), `missing label for ${state}`).toBeTruthy();
    }
  });

  it("distinguishes waiting on the instructor from needing the student to act", () => {
    expect(statusLabel("submitted")).not.toBe(statusLabel("revision_requested"));
  });
});
