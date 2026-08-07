// H2O Brain Curator — the review queue between the asset library and the curriculum.
//
// A suggestion is deliberately independent of whatever produced it. Today the sources are the
// owner's own rules and what the admin approved before; an AI provider can be added later as one
// more source without changing anything below. See docs/module-24-brain-curator-audit.md.

import type { StageSurface } from "@/lib/academy-control/types";

export const RULE_FIELDS = ["title", "originalName", "mimeType", "assetSubtype", "folderId"] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export const RULE_OPERATORS = ["contains", "equals", "startsWith", "endsWith"] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export const SUGGESTION_SOURCES = ["rule", "memory", "manual", "ai"] as const;
export type SuggestionSource = (typeof SUGGESTION_SOURCES)[number];

export interface BrainRuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

export interface BrainRuleAction {
  stageId?: string;
  nodeId?: string;
  surface?: StageSurface;
}

export interface BrainRule {
  id: string;
  name: string;
  enabled: boolean;
  /** Lower runs later: a rule with priority 10 overrides one with priority 100 on the same field. */
  priority: number;
  conditions: BrainRuleCondition[];
  actions: BrainRuleAction;
}

/** The asset facts a rule is allowed to look at. Nothing here requires reading the file itself. */
export interface BrainCandidate {
  assetId: string;
  title: string;
  originalName: string;
  mimeType: string;
  assetSubtype: string | null;
  folderId: string | null;
}

export interface BrainMemorySignal {
  signalKey: string;
  stageId: string | null;
  nodeId: string | null;
  surface: StageSurface | null;
  evidenceCount: number;
}

export interface BrainSuggestionDraft {
  source: SuggestionSource;
  stageId: string | null;
  nodeId: string | null;
  surface: StageSurface | null;
  confidence: number;
  reason: string;
}

export interface BrainInboxItem {
  id: string;
  assetId: string | null;
  title: string;
  status: "review" | "approved" | "rejected" | "archived";
  createdAt: string;
  candidate: BrainCandidate | null;
  suggestion: {
    id: string;
    source: SuggestionSource;
    stageId: string | null;
    nodeId: string | null;
    surface: StageSurface | null;
    confidence: number;
    reason: string;
    decision: "pending" | "approved" | "edited" | "rejected";
  } | null;
}

export function isRuleField(value: unknown): value is RuleField {
  return typeof value === "string" && (RULE_FIELDS as readonly string[]).includes(value);
}

export function isRuleOperator(value: unknown): value is RuleOperator {
  return typeof value === "string" && (RULE_OPERATORS as readonly string[]).includes(value);
}

/**
 * Keeps unrecognised shapes out of the rule engine rather than letting it guess. conditions/actions
 * are jsonb, so a hand-edited row or an older format can contain anything; everything that does not
 * match this shape is dropped, which makes a broken rule match nothing instead of matching wrongly.
 */
export function toRuleConditions(value: unknown): BrainRuleCondition[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const candidate = entry as Record<string, unknown>;
    if (!isRuleField(candidate.field) || !isRuleOperator(candidate.operator)) return [];
    if (typeof candidate.value !== "string" || !candidate.value.trim()) return [];
    return [{ field: candidate.field, operator: candidate.operator, value: candidate.value }];
  });
}

export function toRuleAction(value: unknown): BrainRuleAction {
  if (typeof value !== "object" || value === null) return {};
  const candidate = value as Record<string, unknown>;
  const action: BrainRuleAction = {};
  if (typeof candidate.stageId === "string" && candidate.stageId) action.stageId = candidate.stageId;
  if (typeof candidate.nodeId === "string" && candidate.nodeId) action.nodeId = candidate.nodeId;
  if (candidate.surface === "learn" || candidate.surface === "create" || candidate.surface === "business" || candidate.surface === "coaching") {
    action.surface = candidate.surface;
  }
  return action;
}
