import { describe, expect, it } from "vitest";
import { getMissionCompletionChecklist } from "@/lib/mission-workspace/completion";

// docs/mission-workspace-v2 §14 mandatory tests — the ones testable without a live Supabase session
// (server-only files like lib/learn-outcome/student.ts cannot be imported by Vitest, same limitation
// hit in every earlier folder this session).
describe("getMissionCompletionChecklist (§3 Readiness != Completion — display-only checklist)", () => {
  it("readiness=100-equivalent (all workspace blocks filled) but a required action is still pending => not every requirement satisfied", () => {
    const items = getMissionCompletionChecklist({
      blocks: [{ id: "b1", label: "Điền Career Map", required: true }],
      values: [{ blockId: "b1", value: "đã điền" }],
      actions: [{ id: "a1", title: "Nộp bằng chi phí", required: true, status: "planned" }],
      evidence: [],
      completionPolicy: "self_reported",
      displayState: "doing"
    });
    expect(items.some((i) => i.satisfied === false)).toBe(true);
    expect(items.find((i) => i.id === "action:a1")?.satisfied).toBe(false);
  });

  it("all required workspace blocks + actions pass and no evidence needed => every requirement satisfied", () => {
    const items = getMissionCompletionChecklist({
      blocks: [{ id: "b1", label: "Điền mục tiêu", required: true }],
      values: [{ blockId: "b1", value: "90 ngày" }],
      actions: [{ id: "a1", title: "Xác nhận lịch", required: true, status: "completed" }],
      evidence: [],
      completionPolicy: "self_reported",
      displayState: "doing"
    });
    expect(items.every((i) => i.satisfied)).toBe(true);
  });

  it("self_reported with no evidence_policy configured never adds an evidence requirement — orientation không ép upload file", () => {
    const items = getMissionCompletionChecklist({ blocks: [], values: [], actions: [], evidence: [], completionPolicy: "self_reported", displayState: "doing" });
    expect(items.some((i) => i.source === "evidence")).toBe(false);
  });

  it("evidence_required with no evidence submitted yet => evidence requirement not satisfied", () => {
    const items = getMissionCompletionChecklist({ blocks: [], values: [], actions: [], evidence: [], completionPolicy: "evidence_required", displayState: "doing" });
    const req = items.find((i) => i.source === "evidence");
    expect(req?.satisfied).toBe(false);
  });

  it("evidence_required with evidence submitted => evidence requirement satisfied", () => {
    const items = getMissionCompletionChecklist({ blocks: [], values: [], actions: [], evidence: [{ note: "đã nộp" }], completionPolicy: "evidence_required", displayState: "evidence_pending" });
    const req = items.find((i) => i.source === "evidence");
    expect(req?.satisfied).toBe(true);
  });

  it("teacher_verified is not satisfied before the teacher verifies, even with evidence submitted", () => {
    const items = getMissionCompletionChecklist({ blocks: [], values: [], actions: [], evidence: [{ note: "đã nộp" }], completionPolicy: "teacher_verified", displayState: "review_pending" });
    const teacherReq = items.find((i) => i.source === "teacher_review");
    expect(teacherReq?.satisfied).toBe(false);
  });

  it("teacher_verified is satisfied once displayState reflects a real teacher verification", () => {
    const items = getMissionCompletionChecklist({ blocks: [], values: [], actions: [], evidence: [{ note: "đã nộp" }], completionPolicy: "teacher_verified", displayState: "verified" });
    const teacherReq = items.find((i) => i.source === "teacher_review");
    expect(teacherReq?.satisfied).toBe(true);
  });

  it("metric_based has no automatic threshold engine yet — reported honestly as an unresolved requirement, not silently satisfied", () => {
    const items = getMissionCompletionChecklist({ blocks: [], values: [], actions: [], evidence: [], completionPolicy: "metric_based", displayState: "doing" });
    const metricReq = items.find((i) => i.source === "metric");
    expect(metricReq?.satisfied).toBe(false);
  });
});
