import type { CoachCondition, CoachRuntimeContext, CoachTurnResult, LearnerMemoryValue } from "./types";

function memoryMap(memory: LearnerMemoryValue[]): Map<string, unknown> {
  return new Map(memory.filter((v) => v.status === "confirmed").map((v) => [v.field, v.value]));
}

function checkCondition(condition: CoachCondition, values: Map<string, unknown>): boolean {
  const current = values.get(condition.field);
  switch (condition.op) {
    case "missing": return current === undefined || current === null || current === "";
    case "present": return !(current === undefined || current === null || current === "");
    case "eq": return current === condition.value;
    case "neq": return current !== condition.value;
    case "contains":
      if (Array.isArray(current)) return current.includes(condition.value);
      if (typeof current === "string") return current.includes(String(condition.value ?? ""));
      return false;
    default: return false;
  }
}

/** Highest-priority question whose every condition is satisfied by confirmed memory — deterministic, no LLM. */
export function nextOfflineQuestion(ctx: CoachRuntimeContext): string | null {
  const values = memoryMap(ctx.memory);
  const ordered = [...ctx.missionConfig.questions].sort((a, b) => b.priority - a.priority);
  for (const q of ordered) {
    if (q.when.every((c) => checkCondition(c, values))) return q.prompt;
  }
  return null;
}

/** Which required fields still lack a confirmed value — used both for the offline reply and for the Result tab's "còn thiếu" list. */
export function missingRequiredFields(ctx: CoachRuntimeContext): string[] {
  const values = memoryMap(ctx.memory);
  return ctx.missionConfig.requiredFields.filter((field) => {
    const value = values.get(field);
    return value === undefined || value === null || value === "";
  });
}

/**
 * Offline engine is fully deterministic — no natural-language understanding, no LLM call. The UI
 * collects structured answers via quick replies/form chips against nextQuestion's targetField. This
 * is the source package's own explicit requirement ("Offline mode phải có giá trị thật, không phải
 * placeholder") — it must produce a real, working question flow with zero AI configured, and it does:
 * H2OCoachService (lib/h2o-coach/service.ts) calls this whenever providerMode is "offline" or no AI
 * provider is configured, regardless of a Stage profile's declared providerMode.
 */
export function runOfflineCoachTurn(ctx: CoachRuntimeContext): CoachTurnResult {
  const nextQuestion = nextOfflineQuestion(ctx);
  if (nextQuestion) {
    return { reply: nextQuestion, candidates: [], nextQuestion, completionHints: [] };
  }
  const stillMissing = missingRequiredFields(ctx);
  if (stillMissing.length) {
    return {
      reply: "Mình cần thêm một vài thông tin nữa trước khi tổng hợp kết quả cho bạn.",
      candidates: [], nextQuestion: null, completionHints: stillMissing
    };
  }
  return {
    reply: "Mình đã có đủ dữ liệu chính cho bước này. Hãy kiểm tra bản tổng hợp bên phải trước khi chốt kết quả.",
    candidates: [], nextQuestion: null,
    completionHints: ["Xem lại hồ sơ đã tổng hợp", "Hoàn thành theo tiêu chí Mission thật"]
  };
}
