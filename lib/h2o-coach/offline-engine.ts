import { missionConfirmedFieldKey, type CoachCandidateExtraction, type CoachCondition, type CoachMemoryFieldSchema, type CoachMissionHealth, type CoachMissionState, type CoachNextBestAction, type CoachRuntimeContext, type CoachTurnResult, type LearnerMemoryValue } from "./types";

function confirmedValueMap(memory: LearnerMemoryValue[]): Map<string, unknown> {
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

/** Highest-priority question rule whose every condition is satisfied by confirmed memory — deterministic, no LLM. Returns the whole rule (not just the prompt text) so callers can also read its target field. */
export function nextOfflineQuestionRule(ctx: CoachRuntimeContext) {
  const values = confirmedValueMap(ctx.memory);
  const ordered = [...ctx.missionConfig.questions].sort((a, b) => b.priority - a.priority);
  for (const q of ordered) {
    if (q.when.every((c) => checkCondition(c, values))) return q;
  }
  return null;
}

export function nextOfflineQuestion(ctx: CoachRuntimeContext): string | null {
  return nextOfflineQuestionRule(ctx)?.prompt ?? null;
}

/** A question rule's own field if declared, otherwise its single `when` condition's field — true for every question this session's Coach Builder UI has ever produced (one condition per question). */
export function questionTargetField(rule: { targetField?: string; when: CoachCondition[] }): string | null {
  return rule.targetField || rule.when[0]?.field || null;
}

/** Which required fields still lack a confirmed value — used both for the offline reply and for the Result tab's "còn thiếu" list. */
export function missingRequiredFields(ctx: CoachRuntimeContext): string[] {
  const values = confirmedValueMap(ctx.memory);
  return ctx.missionConfig.requiredFields.filter((field) => {
    const value = values.get(field);
    return value === undefined || value === null || value === "";
  });
}

/**
 * STEP 5 of the required pipeline (USER MESSAGE -> EXTRACT). Fully deterministic keyword/substring
 * match against each field's admin-configured extractionRules — never a probabilistic guess, so a
 * match is written straight to memory as "confirmed" (see candidateToMemoryValue in service.ts),
 * unlike an AI-mode candidate which stays "proposed" until the learner explicitly confirms it.
 * A single message can satisfy multiple fields at once (checks every not-yet-confirmed field, not
 * just the one the last question targeted) — "tôi muốn theo cô dâu phong cách Hàn Quốc" fills both
 * career.direction and style.preference in one turn if both have a matching rule.
 * A field with no extractionRules configured is simply never offline-fillable — real limitation,
 * not silently pretended away; the admin must add rules or turn on AI/Hybrid mode for that Stage.
 */
export function extractCandidatesFromText(message: string, memorySchema: CoachMemoryFieldSchema[], confirmedFieldKeys: ReadonlySet<string>): CoachCandidateExtraction[] {
  const lower = message.toLowerCase();
  const candidates: CoachCandidateExtraction[] = [];
  for (const field of memorySchema) {
    if (confirmedFieldKeys.has(field.key)) continue;
    const rule = (field.extractionRules ?? []).find((r) => r.pattern.trim() && lower.includes(r.pattern.toLowerCase()));
    if (rule) candidates.push({ field: field.key, value: rule.value, confidence: 1, rationale: `khớp từ khoá "${rule.pattern}"`, requiresConfirmation: false });
  }
  return candidates;
}

const CONFIRM_KEYWORDS = ["đúng rồi", "đúng vậy", "chuẩn rồi", "chính xác", "chuẩn", "đúng", "ừ", "vâng", "ok", "oke", "okay", "yes", "confirm"];
const REJECT_KEYWORDS = ["chỉnh lại", "sai rồi", "không đúng", "chưa đúng", "sai", "no", "sửa lại", "sửa"];

/** STEP 7: confirm-intent detection while awaiting the mission summary confirmation — checked BEFORE reject so "sai" inside "sai rồi" doesn't also match a looser confirm keyword. */
export function detectConfirmIntent(message: string): "confirm" | "reject" | "unclear" {
  const lower = message.toLowerCase().trim();
  if (REJECT_KEYWORDS.some((k) => lower.includes(k))) return "reject";
  if (CONFIRM_KEYWORDS.some((k) => lower.includes(k))) return "confirm";
  return "unclear";
}

/** STEP 8: progress = confirmed requirements / (required fields + the final confirmation itself). Never derived from conversation text or turn count. */
export function calculateCoachProgress(requiredFields: string[], memory: LearnerMemoryValue[], missionId: string): number {
  const confirmed = new Set(memory.filter((v) => v.status === "confirmed").map((v) => v.field));
  const total = requiredFields.length + 1;
  const satisfied = requiredFields.filter((f) => confirmed.has(f)).length + (confirmed.has(missionConfirmedFieldKey(missionId)) ? 1 : 0);
  return Math.round((satisfied / total) * 100);
}

/** STEP 3: which state the Mission's Coach flow is in — driven by real memory rows, never by which question was last asked. */
export function determineMissionState(requiredFields: string[], memory: LearnerMemoryValue[], missionId: string): CoachMissionState {
  const confirmed = new Set(memory.filter((v) => v.status === "confirmed").map((v) => v.field));
  if (confirmed.has(missionConfirmedFieldKey(missionId))) return "confirmed";
  return requiredFields.every((f) => confirmed.has(f)) ? "awaiting_confirmation" : "in_progress";
}

/**
 * H2O Coach Workspace Smart V2 (v5/41) — a richer readiness signal than the single progressPercent
 * badge, entirely derived from real memory rows (never a placeholder). `understanding` counts any
 * value yet (confirmed OR still-proposed) as "H2O has heard this from you"; `dataCompleteness` only
 * counts confirmed values. In pure offline mode candidates are written straight to `confirmed` (see
 * extractCandidatesFromText's requiresConfirmation: false), so the two numbers usually match today —
 * they only diverge once Hybrid/AI mode's proposed-then-confirm flow is actually in use.
 * `resultReadiness` folds in the learner's own final "Đúng rồi" (missionState), not just field
 * completeness — the same "readiness ≠ completion" principle already governs the completion resolver.
 */
export function calculateMissionHealth(ctx: CoachRuntimeContext): CoachMissionHealth {
  const required = ctx.missionConfig.requiredFields;
  if (!required.length) return { understanding: 100, dataCompleteness: 100, resultReadiness: 100 };
  const hasAny = new Set(ctx.memory.filter((v) => v.status === "confirmed" || v.status === "proposed").map((v) => v.field));
  const confirmed = new Set(ctx.memory.filter((v) => v.status === "confirmed").map((v) => v.field));
  const understanding = Math.round((required.filter((f) => hasAny.has(f)).length / required.length) * 100);
  const dataCompleteness = Math.round((required.filter((f) => confirmed.has(f)).length / required.length) * 100);
  const missionState = determineMissionState(required, ctx.memory, ctx.missionId);
  const resultReadiness = missionState === "confirmed" ? 100 : missionState === "awaiting_confirmation" ? 80 : dataCompleteness;
  return { understanding, dataCompleteness, resultReadiness };
}

/**
 * Deterministic "what should the learner do next" — every branch maps 1:1 to state already computed
 * elsewhere (missionState, the active question, the evidence handoff), never a guess or an LLM call.
 * `evidencePending` is passed in rather than recomputed here since it depends on the Mission's
 * completion_policy, which offline-engine.ts's pure functions don't have access to (see service.ts).
 */
export function nextBestAction(ctx: CoachRuntimeContext, evidencePending: boolean): CoachNextBestAction | null {
  const missionState = determineMissionState(ctx.missionConfig.requiredFields, ctx.memory, ctx.missionId);
  if (missionState === "confirmed") {
    return evidencePending
      ? { title: "Nộp minh chứng để hoàn thành", reason: "Đã ghi nhận đủ thông tin — chỉ còn thiếu minh chứng thật để chính thức hoàn thành Mission này.", actionKey: "submit_evidence" }
      : null;
  }
  if (missionState === "awaiting_confirmation") {
    return { title: "Xác nhận tổng kết", reason: "H2O đã tổng hợp đủ thông tin bên dưới — trả lời \"Đúng rồi\" để chốt lại.", actionKey: "confirm_summary" };
  }
  const question = nextOfflineQuestion(ctx);
  return question ? { title: "Trả lời câu hỏi hiện tại", reason: question, actionKey: "answer_question" } : null;
}

function fieldLabel(memorySchema: CoachMemoryFieldSchema[], key: string): string {
  return memorySchema.find((f) => f.key === key)?.label ?? key;
}

function displayValue(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

/** STEP 7 reply: names every confirmed required field, then asks for explicit confirmation. */
export function buildSummaryReply(ctx: CoachRuntimeContext): string {
  const confirmed = confirmedValueMap(ctx.memory);
  const lines = ctx.missionConfig.requiredFields.map((key) => `- ${fieldLabel(ctx.profile.memorySchema, key)}: ${displayValue(confirmed.get(key))}`);
  return `Mình tổng hợp lại những gì đã hiểu về bạn:\n${lines.join("\n")}\n\nĐây có đúng với định hướng hiện tại của bạn không?`;
}

function acknowledgment(justExtracted: CoachCandidateExtraction[], memorySchema: CoachMemoryFieldSchema[]): string {
  if (!justExtracted.length) return "";
  const parts = justExtracted.map((c) => `${fieldLabel(memorySchema, c.field)} là ${displayValue(c.value)}`);
  return `Đã hiểu. ${parts.join(", ")}. `;
}

/**
 * STEP 6/7/10: the reply-composition step. `ctx.memory` must already be the freshly re-queried,
 * post-persist state (STEP 4's ordering) — this function never itself writes anything, it only
 * decides what to say given memory as it now stands. `justExtracted` is only used to phrase a natural
 * acknowledgment ("Đã hiểu...") instead of jumping straight to the next question with no transition.
 */
export function runOfflineCoachTurn(ctx: CoachRuntimeContext, justExtracted: CoachCandidateExtraction[] = []): CoachTurnResult {
  const missionState = determineMissionState(ctx.missionConfig.requiredFields, ctx.memory, ctx.missionId);
  const progressPercent = calculateCoachProgress(ctx.missionConfig.requiredFields, ctx.memory, ctx.missionId);
  const health = calculateMissionHealth(ctx);
  const ack = acknowledgment(justExtracted, ctx.profile.memorySchema);

  if (missionState === "confirmed") {
    return { reply: "Mission này đã hoàn thành. Bạn có thể xem lại hồ sơ đã tổng hợp bên phải bất cứ lúc nào.", candidates: [], nextQuestion: null, missionState, progressPercent, health };
  }
  if (missionState === "awaiting_confirmation") {
    return { reply: ack + buildSummaryReply(ctx), candidates: [], nextQuestion: null, missionState, progressPercent, health };
  }

  const nextQuestion = nextOfflineQuestion(ctx);
  if (nextQuestion) {
    return { reply: ack + nextQuestion, candidates: [], nextQuestion, missionState, progressPercent, health };
  }
  const stillMissing = missingRequiredFields(ctx);
  return {
    reply: ack || "Mình cần thêm một vài thông tin nữa trước khi tổng hợp kết quả cho bạn.",
    candidates: [], nextQuestion: null, missionState, progressPercent, health, completionHints: stillMissing
  };
}
