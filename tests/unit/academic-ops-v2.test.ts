import { describe, expect, it } from "vitest";
import { buildAcademicOpsViewModel } from "@/lib/academic-ops-v2/selectors";
import {
  automationRules,
  classProgressColumns,
  classProgressRows,
  collaborationMembers,
  feedbackItems,
  reviewRequests,
  studentAccessRows
} from "@/lib/academic-ops-v2/teaching-data";

const input = {
  books: [], classes: [], assignments: [], quizzes: [], students: [], learningGoals: [], learningNotes: [], flashcards: [], studySessions: [], knowledgeSources: []
};

describe("Academic Operations V2", () => {
  it("builds a safe empty view model", () => {
    const model = buildAcademicOpsViewModel(input);
    expect(model.metrics.mastery).toBe(0);
    expect(model.metrics.pendingGrades).toBe(0);
    expect(model.books).toEqual([]);
  });

  it("ships complete teaching operations fallback data", () => {
    expect(automationRules.length).toBeGreaterThanOrEqual(3);
    expect(classProgressColumns.length).toBeGreaterThanOrEqual(3);
    expect(classProgressRows.length).toBeGreaterThanOrEqual(3);
    expect(collaborationMembers.length).toBeGreaterThanOrEqual(3);
    expect(feedbackItems.length).toBeGreaterThanOrEqual(2);
    expect(reviewRequests.length).toBeGreaterThanOrEqual(3);
    expect(studentAccessRows.length).toBeGreaterThanOrEqual(5);
  });
});
