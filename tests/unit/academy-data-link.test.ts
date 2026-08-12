import { describe, expect, it } from "vitest";
import { assertStageContextConsistency } from "@/lib/academy-data-link/stage-context-validator";

describe("assertStageContextConsistency (P1 Stage badge fix)", () => {
  it("is consistent when the student has no Journey activity yet", () => {
    const result = assertStageContextConsistency({ assignedStageId: "stage-1", journeyStageId: null });
    expect(result.isConsistent).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("is consistent when the assigned Stage and the Journey Stage agree", () => {
    const result = assertStageContextConsistency({ assignedStageId: "stage-1", journeyStageId: "stage-1" });
    expect(result.isConsistent).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags a mismatch when the student's most recent Mission belongs to a different Stage", () => {
    const result = assertStageContextConsistency({ assignedStageId: "stage-2", journeyStageId: "stage-1" });
    expect(result.isConsistent).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatch(/khác Stage/);
  });
});
