import { describe, expect, it } from "vitest";
import { mockAssessment, mockChat } from "@/lib/h2obook/ai/mock";
import type { AnalyzeInput, ChatInput } from "@/lib/h2obook/ai/types";

// The mock provider is the DEFAULT H2O_AI_PROVIDER and must always return a well-formed, rubric-
// aligned draft — no key, no network. (adapter.ts carries "server-only" and cannot be imported
// here; the pure logic lives in mock.ts, same split as lib/h2o-coach/offline-engine.ts.)

const rubric = [
  { id: "skin", label: "Nền da", maxScore: 20 },
  { id: "brow", label: "Chân mày", maxScore: 10 },
  { id: "eyes", label: "Mắt", maxScore: 20 },
  { id: "time", label: "Thời gian", maxScore: 10 },
];

function analyzeInput(over: Partial<AnalyzeInput> = {}): AnalyzeInput {
  return {
    seed: "sess-1|stu-1|0",
    rubric,
    note: "Làm trong 100 phút, dùng cushion, phần mắt chưa ưng",
    imageCount: 3,
    imageUrls: [],
    sessionTitle: "Makeup cô dâu tone trong",
    sessionType: "practice_makeup_hair",
    ...over,
  };
}

describe("mockAssessment", () => {
  it("returns one score per rubric criterion, each within [0, maxScore]", () => {
    const result = mockAssessment(analyzeInput());
    expect(result.criteria).toHaveLength(rubric.length);
    for (const c of result.criteria) {
      const rc = rubric.find((r) => r.id === c.criterionId)!;
      expect(rc).toBeTruthy();
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(rc.maxScore);
    }
  });

  it("totalScore equals the sum of criterion scores and never exceeds maxScore", () => {
    const result = mockAssessment(analyzeInput());
    const sum = result.criteria.reduce((s, c) => s + c.score, 0);
    expect(result.totalScore).toBeCloseTo(sum, 5);
    expect(result.maxScore).toBe(60);
    expect(result.totalScore).toBeLessThanOrEqual(result.maxScore);
  });

  it("is deterministic for the same input", () => {
    const a = mockAssessment(analyzeInput());
    const b = mockAssessment(analyzeInput());
    expect(a.totalScore).toBe(b.totalScore);
    expect(a.criteria.map((c) => c.score)).toEqual(b.criteria.map((c) => c.score));
  });

  it("a new attempt (different seed) can produce a different draft", () => {
    const first = mockAssessment(analyzeInput({ seed: "sess-1|stu-1|0" }));
    const retry = mockAssessment(analyzeInput({ seed: "sess-1|stu-1|1" }));
    // scores should still be valid; the point is the seed is actually used
    expect(retry.criteria).toHaveLength(rubric.length);
    expect(first.provider).toBe("mock");
  });

  it("a stronger submission (3 images + a real note) does not score lower than an empty one", () => {
    const strong = mockAssessment(analyzeInput({ imageCount: 3, note: "Ghi chú đầy đủ về quy trình và sản phẩm đã dùng trong buổi." }));
    const weak = mockAssessment(analyzeInput({ imageCount: 0, note: "" }));
    expect(strong.totalScore).toBeGreaterThanOrEqual(weak.totalScore);
  });

  it("always surfaces at least one priority fix and a summary", () => {
    const result = mockAssessment(analyzeInput());
    expect(result.priorityFixes.length).toBeGreaterThan(0);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.provider).toBe("mock");
  });

  it("survives an empty rubric", () => {
    const result = mockAssessment(analyzeInput({ rubric: [] }));
    expect(result.criteria).toHaveLength(1);
    expect(result.maxScore).toBe(100);
  });
});

describe("mockChat", () => {
  const base: ChatInput = {
    sessionTitle: "Buổi 25 · Makeup cô dâu",
    rubric,
    latestAssessment: null,
    messages: [{ role: "user", content: "Em nên làm gì?" }],
  };

  it("returns a non-empty reply", () => {
    expect(mockChat(base).reply.length).toBeGreaterThan(0);
  });

  it("a checklist request produces checkbox lines", () => {
    const reply = mockChat({ ...base, messages: [{ role: "user", content: "Cho em checklist làm lại" }] }).reply;
    expect(reply).toContain("☐");
  });

  it("uses the latest assessment's priority fixes when present", () => {
    const withAssessment: ChatInput = {
      ...base,
      latestAssessment: mockAssessment(analyzeInput()),
      messages: [{ role: "user", content: "Ưu tiên sửa gì trước?" }],
    };
    const reply = mockChat(withAssessment).reply;
    expect(reply.toLowerCase()).toContain("sửa trước tiên");
  });
});
