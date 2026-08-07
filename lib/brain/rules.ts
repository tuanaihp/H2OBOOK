// Pure classification logic for H2O Brain: no database, no network, no AI. Everything here is a
// function of its arguments, which is why it is the part that can actually be tested.

import type { BrainCandidate, BrainMemorySignal, BrainRule, BrainRuleAction, BrainRuleCondition, BrainSuggestionDraft } from "./types";

/**
 * Rule matching is case-insensitive but keeps diacritics. Stripping them would make "nen" match
 * "nền", which sounds helpful until a rule written for one Vietnamese word starts catching another;
 * the admin writes these rules themselves and can type the accents.
 */
function fieldValue(candidate: BrainCandidate, field: BrainRuleCondition["field"]): string {
  switch (field) {
    case "title": return candidate.title;
    case "originalName": return candidate.originalName;
    case "mimeType": return candidate.mimeType;
    case "assetSubtype": return candidate.assetSubtype ?? "";
    case "folderId": return candidate.folderId ?? "";
  }
}

export function matchesCondition(candidate: BrainCandidate, condition: BrainRuleCondition): boolean {
  const actual = fieldValue(candidate, condition.field).toLowerCase();
  const expected = condition.value.trim().toLowerCase();
  if (!expected) return false;
  switch (condition.operator) {
    case "contains": return actual.includes(expected);
    case "equals": return actual === expected;
    case "startsWith": return actual.startsWith(expected);
    case "endsWith": return actual.endsWith(expected);
  }
}

/**
 * Every condition must hold. A rule with no conditions matches nothing rather than everything —
 * an empty condition list is almost always a half-finished rule, and the version that fires on
 * every document is the expensive way to find that out.
 */
export function ruleMatches(candidate: BrainCandidate, rule: BrainRule): boolean {
  if (!rule.enabled) return false;
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((condition) => matchesCondition(candidate, condition));
}

export interface RuleEvaluation {
  action: BrainRuleAction;
  matched: string[];
}

/**
 * Merges the actions of every matching rule, letting lower `priority` numbers win field by field.
 * Merging rather than first-match-wins lets one broad rule set the stage and a narrow one refine
 * the surface, instead of forcing every rule to restate the whole destination.
 */
export function evaluateRules(candidate: BrainCandidate, rules: BrainRule[]): RuleEvaluation {
  const matching = rules.filter((rule) => ruleMatches(candidate, rule));
  // Apply weakest first so the strongest (lowest priority number) overwrites it.
  const ordered = matching.slice().sort((a, b) => b.priority - a.priority);
  const action: BrainRuleAction = {};
  for (const rule of ordered) {
    if (rule.actions.stageId) action.stageId = rule.actions.stageId;
    if (rule.actions.nodeId) action.nodeId = rule.actions.nodeId;
    if (rule.actions.surface) action.surface = rule.actions.surface;
  }
  return {
    action,
    matched: matching.slice().sort((a, b) => a.priority - b.priority).map((rule) => rule.name)
  };
}

/**
 * The handles memory is keyed by. Deliberately coarse: an admin filing thirty product photos is
 * making one decision about a kind of thing, not thirty decisions about thirty files.
 */
export function computeSignalKeys(candidate: BrainCandidate): string[] {
  const keys: string[] = [];
  if (candidate.assetSubtype) keys.push(`subtype:${candidate.assetSubtype.toLowerCase()}`);
  if (candidate.mimeType) keys.push(`mime:${candidate.mimeType.toLowerCase()}`);
  if (candidate.folderId) keys.push(`folder:${candidate.folderId}`);
  return keys;
}

export type MemoryMatch = BrainMemorySignal;

/**
 * Picks what the admin confirmed most often for any of this candidate's keys. Ties break toward the
 * earlier key, and computeSignalKeys orders them most-specific first (subtype, then mime, then
 * folder), so a tie resolves to the more precise signal.
 */
export function pickFromMemory(keys: string[], signals: BrainMemorySignal[]): MemoryMatch | null {
  let best: MemoryMatch | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const signal of signals) {
    const rank = keys.indexOf(signal.signalKey);
    if (rank === -1) continue;
    if (!signal.stageId) continue;
    if (!best || signal.evidenceCount > best.evidenceCount || (signal.evidenceCount === best.evidenceCount && rank < bestRank)) {
      best = signal;
      bestRank = rank;
    }
  }
  return best;
}

// Confidence is an ordering hint for the review queue, not a probability. A rule the owner wrote is
// as close to certain as this system gets; memory earns trust as it is confirmed, and is capped
// below the rule score so an explicit rule always sorts above a learned habit.
const RULE_CONFIDENCE = 0.95;
const MEMORY_BASE = 0.35;
const MEMORY_STEP = 0.1;
const MEMORY_CEILING = 0.85;

export function memoryConfidence(evidenceCount: number): number {
  return Math.min(MEMORY_BASE + MEMORY_STEP * Math.max(evidenceCount - 1, 0), MEMORY_CEILING);
}

/**
 * Rules first, then memory, then nothing. "Nothing" is a real outcome: an item with no suggestion
 * still belongs in the queue for the admin to file by hand, and inventing a destination for it
 * would be worse than admitting there isn't one.
 */
export function buildSuggestion(candidate: BrainCandidate, rules: BrainRule[], signals: BrainMemorySignal[]): BrainSuggestionDraft {
  const evaluation = evaluateRules(candidate, rules);
  if (evaluation.action.stageId) {
    return {
      source: "rule",
      stageId: evaluation.action.stageId,
      nodeId: evaluation.action.nodeId ?? null,
      surface: evaluation.action.surface ?? null,
      confidence: RULE_CONFIDENCE,
      reason: `Khớp luật: ${evaluation.matched.join(", ")}`
    };
  }

  const memory = pickFromMemory(computeSignalKeys(candidate), signals);
  if (memory?.stageId) {
    return {
      source: "memory",
      stageId: memory.stageId,
      // A rule that matched but had no stage can still contribute the surface.
      nodeId: memory.nodeId,
      surface: memory.surface ?? evaluation.action.surface ?? null,
      confidence: memoryConfidence(memory.evidenceCount),
      reason: `Bạn đã duyệt ${memory.evidenceCount} tài liệu tương tự vào đây (${memory.signalKey})`
    };
  }

  return {
    source: "manual",
    stageId: null,
    nodeId: evaluation.action.nodeId ?? null,
    surface: evaluation.action.surface ?? null,
    confidence: 0,
    reason: evaluation.matched.length
      ? `Có luật khớp (${evaluation.matched.join(", ")}) nhưng chưa luật nào chỉ định giai đoạn`
      : "Chưa có luật nào khớp và chưa có tiền lệ đã duyệt — cần chọn tay"
  };
}
