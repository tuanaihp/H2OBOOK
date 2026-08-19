import { describe, expect, it } from "vitest";
import { calculateCoachProgress, calculateMissionHealth, detectConfirmIntent, determineMissionState, extractCandidatesFromText, missingRequiredFields, nextBestAction, nextOfflineQuestion, nextOfflineQuestionRule, questionTargetField, runOfflineCoachTurn } from "@/lib/h2o-coach/offline-engine";
import { missionConfirmedFieldKey, type CoachMemoryFieldSchema, type CoachRuntimeContext, type LearnerMemoryValue, type MissionCoachConfig } from "@/lib/h2o-coach/types";

// docs/h2o-coach-v1 + the 2026-08-15 "Mission Coach state / H2O Brain memory sync" fix — the ones
// testable without a live Supabase session (lib/h2o-coach/service.ts, repository.ts, memory.ts,
// admin.ts all carry "server-only" and cannot be imported by Vitest, same limitation every prior
// folder this session hit). offline-engine.ts has no server import on purpose so the deterministic
// extract/state/progress pipeline the fix introduced is directly verifiable — the whole point of the
// fix was to stop letting an LLM (or nothing at all, in offline mode's original zero-extraction form)
// silently manage Mission state.

const MISSION_ID = "m1";

const memorySchema: CoachMemoryFieldSchema[] = [
  { key: "career.direction", label: "Hướng nghề", namespace: "career", type: "text", requiresConfirmation: true, extractionRules: [{ pattern: "cô dâu", value: "Bridal Makeup" }] },
  { key: "career.target_customer", label: "Khách hàng mục tiêu", namespace: "career", type: "text", requiresConfirmation: true, extractionRules: [{ pattern: "trẻ", value: "Khách trẻ 20-30" }] },
  { key: "style.preference", label: "Phong cách", namespace: "style", type: "text", requiresConfirmation: true, extractionRules: [{ pattern: "hàn quốc", value: "Korean" }] }
];

function missionConfig(overrides: Partial<MissionCoachConfig> = {}): MissionCoachConfig {
  return {
    id: "mc1", profileVersionId: "pv1", missionId: MISSION_ID, objective: "Xác định hướng nghề Makeup",
    coachInstructions: "", rubric: {}, evidenceRequirements: [],
    requiredFields: ["career.direction", "career.target_customer"],
    questions: [
      { id: "q1", when: [{ field: "career.direction", op: "missing" }], prompt: "Bạn muốn theo hướng Makeup nào?", priority: 2 },
      { id: "q2", when: [{ field: "career.target_customer", op: "missing" }], prompt: "Khách hàng mục tiêu của bạn là ai?", priority: 1 }
    ],
    tools: [], ...overrides
  };
}

function ctx(memory: LearnerMemoryValue[], config: MissionCoachConfig = missionConfig()): CoachRuntimeContext {
  return {
    organizationId: "org1", learnerId: "u1", stageId: "s1", missionId: MISSION_ID, memory, missionConfig: config,
    profile: { id: "pv1", organizationId: "org1", profileId: "p1", versionNumber: 1, status: "published", name: "", coachRole: "H2O Coach", systemTone: "", providerMode: "offline", knowledgeScope: { resourceIds: [], allowMissionBindings: true, allowStageCurriculum: true }, memorySchema, publishedAt: null, createdAt: "", updatedAt: "" }
  };
}
function confirmedField(field: string, value: unknown): LearnerMemoryValue {
  return { field, namespace: field.split(".")[0], value, status: "confirmed", updatedAt: "now" };
}

describe("extractCandidatesFromText (STEP 5 — the root cause fix: offline mode used to have zero text-understanding at all)", () => {
  it("CASE A: 'cô dâu' extracts career.direction, nothing else", () => {
    const result = extractCandidatesFromText("cô dâu", memorySchema, new Set());
    expect(result).toEqual([{ field: "career.direction", value: "Bridal Makeup", confidence: 1, rationale: expect.any(String), requiresConfirmation: false }]);
  });

  it("CASE B: one message can fill multiple fields at once", () => {
    const result = extractCandidatesFromText("tôi muốn theo cô dâu phong cách Hàn Quốc", memorySchema, new Set());
    const fields = result.map((c) => c.field).sort();
    expect(fields).toEqual(["career.direction", "style.preference"]);
    expect(result.find((c) => c.field === "career.direction")?.value).toBe("Bridal Makeup");
    expect(result.find((c) => c.field === "style.preference")?.value).toBe("Korean");
  });

  it("does not re-extract a field that is already confirmed", () => {
    const result = extractCandidatesFromText("cô dâu", memorySchema, new Set(["career.direction"]));
    expect(result).toEqual([]);
  });

  it("a field with no matching rule text produces no candidate — never guesses", () => {
    const result = extractCandidatesFromText("tôi chưa biết mình muốn gì", memorySchema, new Set());
    expect(result).toEqual([]);
  });

  it("deterministic offline matches carry requiresConfirmation:false — a keyword match is certain, unlike a probabilistic AI guess", () => {
    const result = extractCandidatesFromText("cô dâu", memorySchema, new Set());
    expect(result[0].requiresConfirmation).toBe(false);
  });
});

describe("detectConfirmIntent (STEP 7)", () => {
  it("CASE E: 'đúng rồi' is a confirm", () => { expect(detectConfirmIntent("đúng rồi")).toBe("confirm"); });
  it("recognizes common confirm phrasing", () => {
    for (const text of ["ừ đúng đó", "vâng chuẩn rồi", "ok"]) expect(detectConfirmIntent(text)).toBe("confirm");
  });
  it("recognizes rejection over confirmation when both could match loosely", () => { expect(detectConfirmIntent("chưa đúng, sửa lại")).toBe("reject"); });
  it("an unrelated message is neither", () => { expect(detectConfirmIntent("tôi có 5 năm kinh nghiệm")).toBe("unclear"); });
});

describe("calculateCoachProgress / determineMissionState (STEP 3/STEP 8 — real fields, not turn count or vacuous ratios)", () => {
  it("0 confirmed of 2 required + 1 confirmation = 0%, in_progress", () => {
    expect(calculateCoachProgress(["career.direction", "career.target_customer"], [], MISSION_ID)).toBe(0);
    expect(determineMissionState(["career.direction", "career.target_customer"], [], MISSION_ID)).toBe("in_progress");
  });

  it("CASE A: 1 of 2 required confirmed => 1/3 requirements, not 100% — the exact bug reported (mission showed 100% with empty memory)", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup")];
    expect(calculateCoachProgress(["career.direction", "career.target_customer"], memory, MISSION_ID)).toBe(33);
    expect(determineMissionState(["career.direction", "career.target_customer"], memory, MISSION_ID)).toBe("in_progress");
  });

  it("CASE D: every required field confirmed but not yet learner-confirmed => awaiting_confirmation, still not 100%", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "Khách trẻ 20-30")];
    expect(determineMissionState(["career.direction", "career.target_customer"], memory, MISSION_ID)).toBe("awaiting_confirmation");
    expect(calculateCoachProgress(["career.direction", "career.target_customer"], memory, MISSION_ID)).toBe(67);
  });

  it("CASE E: the synthetic mission-confirmed field flips state to confirmed and progress to 100%", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "Khách trẻ 20-30"), confirmedField(missionConfirmedFieldKey(MISSION_ID), true)];
    expect(determineMissionState(["career.direction", "career.target_customer"], memory, MISSION_ID)).toBe("confirmed");
    expect(calculateCoachProgress(["career.direction", "career.target_customer"], memory, MISSION_ID)).toBe(100);
  });

  it("a rejected (not confirmed) value does not count toward progress", () => {
    const memory: LearnerMemoryValue[] = [{ field: "career.direction", namespace: "career", value: "Bridal Makeup", status: "rejected", updatedAt: "now" }];
    expect(calculateCoachProgress(["career.direction", "career.target_customer"], memory, MISSION_ID)).toBe(0);
  });
});

describe("nextOfflineQuestion (deterministic rule engine — no LLM)", () => {
  it("asks the highest-priority question whose field is still missing", () => {
    expect(nextOfflineQuestion(ctx([]))).toBe("Bạn muốn theo hướng Makeup nào?");
  });

  it("CASE A: once career.direction is confirmed, asks target_customer next — never repeats career.direction", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup")];
    expect(nextOfflineQuestion(ctx(memory))).toBe("Khách hàng mục tiêu của bạn là ai?");
  });

  it("a 'proposed' (not yet confirmed) value does not count as answered — still asks", () => {
    const memory: LearnerMemoryValue[] = [{ field: "career.direction", namespace: "career", value: "Bridal Makeup", status: "proposed", updatedAt: "now" }];
    expect(nextOfflineQuestion(ctx(memory))).toBe("Bạn muốn theo hướng Makeup nào?");
  });
});

describe("missingRequiredFields", () => {
  it("lists every required field with no confirmed value", () => {
    expect(missingRequiredFields(ctx([]))).toEqual(["career.direction", "career.target_customer"]);
  });
  it("excludes a field once confirmed", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup")];
    expect(missingRequiredFields(ctx(memory))).toEqual(["career.target_customer"]);
  });
});

describe("runOfflineCoachTurn — full reply composition given already-fresh (post-persist) memory", () => {
  it("with no memory at all, replies with the first real question, not a placeholder", () => {
    const result = runOfflineCoachTurn(ctx([]));
    expect(result.reply).toBe("Bạn muốn theo hướng Makeup nào?");
    expect(result.missionState).toBe("in_progress");
    expect(result.progressPercent).toBe(0);
  });

  it("CASE A: acknowledges the just-extracted field before asking the next question — not a bare repeat", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup")];
    const justExtracted = extractCandidatesFromText("cô dâu", memorySchema, new Set());
    const result = runOfflineCoachTurn(ctx(memory), justExtracted);
    expect(result.reply).toContain("Bridal Makeup");
    expect(result.reply).toContain("Khách hàng mục tiêu của bạn là ai?");
    expect(result.nextQuestion).toBe("Khách hàng mục tiêu của bạn là ai?");
  });

  it("CASE D: once required fields are complete, shows a summary and asks for confirmation instead of declaring done", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "Khách trẻ 20-30")];
    const result = runOfflineCoachTurn(ctx(memory));
    expect(result.missionState).toBe("awaiting_confirmation");
    expect(result.progressPercent).toBe(67);
    expect(result.reply).toContain("Bridal Makeup");
    expect(result.reply).toContain("Khách trẻ 20-30");
    expect(result.reply).toMatch(/đúng|xác nhận/i);
  });

  it("CASE E: once mission-confirmed, reports done at 100% and stops asking questions", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "Khách trẻ 20-30"), confirmedField(missionConfirmedFieldKey(MISSION_ID), true)];
    const result = runOfflineCoachTurn(ctx(memory));
    expect(result.missionState).toBe("confirmed");
    expect(result.progressPercent).toBe(100);
    expect(result.nextQuestion).toBeNull();
  });

  it("once every question is answered but a required field with no question rule is still missing, prompts for review instead of hallucinating completion", () => {
    const config = missionConfig({ questions: [], requiredFields: ["career.income_goal"] });
    const result = runOfflineCoachTurn(ctx([], config));
    expect(result.nextQuestion).toBeNull();
    expect(result.missionState).toBe("in_progress");
    expect(result.completionHints).toContain("career.income_goal");
  });
});

describe("nextOfflineQuestionRule / questionTargetField (2026-08-16 fix — real-answer fallback when no keyword rule matches)", () => {
  it("returns the active question's own targetField when set", () => {
    const config = missionConfig({ questions: [{ id: "q1", when: [{ field: "career.direction", op: "missing" }], prompt: "?", priority: 1, targetField: "career.direction_custom" }] });
    const rule = nextOfflineQuestionRule(ctx([], config));
    expect(rule && questionTargetField(rule)).toBe("career.direction_custom");
  });

  it("falls back to the single `when` condition's field when targetField is not set — true for every question this session's Coach Builder has ever produced", () => {
    const rule = nextOfflineQuestionRule(ctx([]));
    expect(rule && questionTargetField(rule)).toBe("career.direction");
  });

  it("real bug found in production: 'gái mới lớn'/'18 tuổi nữ' match no keyword rule for career.target_customer, but the active question still correctly targets that field so the fallback in service.ts can capture the raw answer", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup")];
    const rule = nextOfflineQuestionRule(ctx(memory));
    expect(rule?.prompt).toBe("Khách hàng mục tiêu của bạn là ai?");
    expect(rule && questionTargetField(rule)).toBe("career.target_customer");
    // extractCandidatesFromText alone (no fallback) finds nothing for either phrasing — confirms the
    // fallback in service.ts is doing real work, not papering over a case that already worked.
    expect(extractCandidatesFromText("gái mới lớn", memorySchema, new Set(["career.direction"]))).toEqual([]);
    expect(extractCandidatesFromText("18 tuổi nữ", memorySchema, new Set(["career.direction"]))).toEqual([]);
  });

  it("returns null once no question is active (awaiting confirmation or already answered)", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "18 tuổi nữ")];
    expect(nextOfflineQuestionRule(ctx(memory))).toBeNull();
  });
});

describe("calculateMissionHealth (v5/41 H2O Coach Workspace Smart V2 — real, deterministic readiness breakdown, never a placeholder)", () => {
  it("0 of 2 required fields: all three metrics start at 0", () => {
    expect(calculateMissionHealth(ctx([]))).toEqual({ understanding: 0, dataCompleteness: 0, resultReadiness: 0 });
  });

  it("a proposed (not yet confirmed) value raises understanding but not dataCompleteness or resultReadiness", () => {
    const proposed: LearnerMemoryValue = { field: "career.direction", namespace: "career", value: "Bridal Makeup", status: "proposed", updatedAt: "now" };
    const health = calculateMissionHealth(ctx([proposed]));
    expect(health.understanding).toBe(50);
    expect(health.dataCompleteness).toBe(0);
    expect(health.resultReadiness).toBe(0);
  });

  it("all required fields confirmed but not yet learner-confirmed: dataCompleteness 100, resultReadiness only 80 (readiness ≠ completion)", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "Khách trẻ 20-30")];
    const health = calculateMissionHealth(ctx(memory));
    expect(health.understanding).toBe(100);
    expect(health.dataCompleteness).toBe(100);
    expect(health.resultReadiness).toBe(80);
  });

  it("mission fully confirmed: all three metrics reach 100", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "Khách trẻ 20-30"), confirmedField(missionConfirmedFieldKey(MISSION_ID), true)];
    const health = calculateMissionHealth(ctx(memory));
    expect(health).toEqual({ understanding: 100, dataCompleteness: 100, resultReadiness: 100 });
  });
});

describe("nextBestAction (v5/41 — deterministic single next step, every branch maps to state computed elsewhere)", () => {
  it("in_progress with an active question: points at that exact question", () => {
    const action = nextBestAction(ctx([]), false);
    expect(action?.actionKey).toBe("answer_question");
    expect(action?.reason).toBe("Bạn muốn theo hướng Makeup nào?");
  });

  it("awaiting_confirmation: asks the learner to confirm the summary", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "Khách trẻ 20-30")];
    expect(nextBestAction(ctx(memory), false)?.actionKey).toBe("confirm_summary");
  });

  it("confirmed + evidence pending: points at submitting evidence", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "Khách trẻ 20-30"), confirmedField(missionConfirmedFieldKey(MISSION_ID), true)];
    expect(nextBestAction(ctx(memory), true)?.actionKey).toBe("submit_evidence");
  });

  it("confirmed + no evidence needed: nothing left to do on this Mission", () => {
    const memory = [confirmedField("career.direction", "Bridal Makeup"), confirmedField("career.target_customer", "Khách trẻ 20-30"), confirmedField(missionConfirmedFieldKey(MISSION_ID), true)];
    expect(nextBestAction(ctx(memory), false)).toBeNull();
  });
});
