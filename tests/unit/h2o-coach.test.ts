import { describe, expect, it } from "vitest";
import { missingRequiredFields, nextOfflineQuestion, runOfflineCoachTurn } from "@/lib/h2o-coach/offline-engine";
import type { CoachRuntimeContext, LearnerMemoryValue, MissionCoachConfig } from "@/lib/h2o-coach/types";

// docs/h2o-coach-v1 — the ones testable without a live Supabase session (lib/h2o-coach/service.ts,
// repository.ts, memory.ts, admin.ts all carry "server-only" and cannot be imported by Vitest, same
// limitation every prior folder this session hit). offline-engine.ts has no server import on purpose
// so its deterministic behavior — the source spec's explicit "Offline mode phải có giá trị thật,
// không phải placeholder" requirement — is directly verifiable.

function missionConfig(overrides: Partial<MissionCoachConfig> = {}): MissionCoachConfig {
  return {
    id: "mc1", profileVersionId: "pv1", missionId: "m1", objective: "Xác định hướng nghề Makeup",
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
    organizationId: "org1", learnerId: "u1", stageId: "s1", missionId: "m1", memory, missionConfig: config,
    profile: { id: "pv1", organizationId: "org1", profileId: "p1", versionNumber: 1, status: "published", name: "", coachRole: "H2O Coach", systemTone: "", providerMode: "offline", knowledgeScope: { resourceIds: [], allowMissionBindings: true, allowStageCurriculum: true }, memorySchema: [], publishedAt: null, createdAt: "", updatedAt: "" }
  };
}

describe("nextOfflineQuestion (deterministic rule engine — no LLM)", () => {
  it("asks the highest-priority question whose field is still missing", () => {
    expect(nextOfflineQuestion(ctx([]))).toBe("Bạn muốn theo hướng Makeup nào?");
  });

  it("skips a question whose field is already confirmed, asks the next one", () => {
    const memory: LearnerMemoryValue[] = [{ field: "career.direction", namespace: "career", value: "Bridal Makeup", status: "confirmed", updatedAt: "now" }];
    expect(nextOfflineQuestion(ctx(memory))).toBe("Khách hàng mục tiêu của bạn là ai?");
  });

  it("a 'proposed' (not yet confirmed) value does not count as answered — still asks", () => {
    const memory: LearnerMemoryValue[] = [{ field: "career.direction", namespace: "career", value: "Bridal Makeup", status: "proposed", updatedAt: "now" }];
    expect(nextOfflineQuestion(ctx(memory))).toBe("Bạn muốn theo hướng Makeup nào?");
  });

  it("returns null once every question's field is confirmed", () => {
    const memory: LearnerMemoryValue[] = [
      { field: "career.direction", namespace: "career", value: "Bridal Makeup", status: "confirmed", updatedAt: "now" },
      { field: "career.target_customer", namespace: "career", value: "Nữ 22-28", status: "confirmed", updatedAt: "now" }
    ];
    expect(nextOfflineQuestion(ctx(memory))).toBeNull();
  });
});

describe("missingRequiredFields", () => {
  it("lists every required field with no confirmed value", () => {
    expect(missingRequiredFields(ctx([]))).toEqual(["career.direction", "career.target_customer"]);
  });

  it("excludes a field once confirmed", () => {
    const memory: LearnerMemoryValue[] = [{ field: "career.direction", namespace: "career", value: "Bridal Makeup", status: "confirmed", updatedAt: "now" }];
    expect(missingRequiredFields(ctx(memory))).toEqual(["career.target_customer"]);
  });
});

describe("runOfflineCoachTurn (Mission 2 reads Mission 1's confirmed memory — acceptance test B)", () => {
  it("with no memory at all, replies with the first real question, not a placeholder", () => {
    const result = runOfflineCoachTurn(ctx([]));
    expect(result.reply).toBe("Bạn muốn theo hướng Makeup nào?");
    expect(result.nextQuestion).toBe("Bạn muốn theo hướng Makeup nào?");
    expect(result.candidates).toEqual([]);
  });

  it("once every question is answered but a required field is still missing, prompts for review instead of hallucinating completion", () => {
    const config = missionConfig({ questions: [], requiredFields: ["career.income_goal"] });
    const result = runOfflineCoachTurn(ctx([], config));
    expect(result.nextQuestion).toBeNull();
    expect(result.completionHints).toContain("career.income_goal");
  });

  it("once every question AND every required field is satisfied, hands off to the real completion resolver — never marks the Mission done itself", () => {
    const config = missionConfig({ questions: [], requiredFields: ["career.direction"] });
    const memory: LearnerMemoryValue[] = [{ field: "career.direction", namespace: "career", value: "Bridal Makeup", status: "confirmed", updatedAt: "now" }];
    const result = runOfflineCoachTurn(ctx(memory, config));
    expect(result.nextQuestion).toBeNull();
    expect(result.completionHints?.some((h) => h.includes("tiêu chí Mission thật"))).toBe(true);
  });
});
