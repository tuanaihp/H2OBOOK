import { describe, expect, it } from "vitest";
import { buildSuggestion, computeSignalKeys, evaluateRules, matchesCondition, memoryConfidence, pickFromMemory, ruleMatches } from "@/lib/brain/rules";
import { toRuleAction, toRuleConditions } from "@/lib/brain/types";
import type { BrainCandidate, BrainMemorySignal, BrainRule } from "@/lib/brain/types";

const candidate: BrainCandidate = {
  assetId: "asset-1",
  title: "Giáo trình Makeup chuyên nghiệp",
  originalName: "giao-trinh-makeup.pdf",
  mimeType: "application/pdf",
  assetSubtype: "ebook",
  folderId: "folder-1"
};

function rule(overrides: Partial<BrainRule>): BrainRule {
  return {
    id: "r1", name: "Rule", enabled: true, priority: 100,
    conditions: [{ field: "originalName", operator: "contains", value: "makeup" }],
    actions: { stageId: "stage-1" },
    ...overrides
  };
}

describe("brain rule conditions", () => {
  it("matches case-insensitively", () => {
    expect(matchesCondition(candidate, { field: "originalName", operator: "contains", value: "MAKEUP" })).toBe(true);
  });

  it("keeps diacritics significant so one Vietnamese word does not catch another", () => {
    expect(matchesCondition(candidate, { field: "title", operator: "contains", value: "Makeup" })).toBe(true);
    expect(matchesCondition(candidate, { field: "title", operator: "contains", value: "giao trinh" })).toBe(false);
  });

  it("supports equals, startsWith and endsWith", () => {
    expect(matchesCondition(candidate, { field: "mimeType", operator: "equals", value: "application/pdf" })).toBe(true);
    expect(matchesCondition(candidate, { field: "originalName", operator: "startsWith", value: "giao-" })).toBe(true);
    expect(matchesCondition(candidate, { field: "originalName", operator: "endsWith", value: ".pdf" })).toBe(true);
    expect(matchesCondition(candidate, { field: "originalName", operator: "endsWith", value: ".mp4" })).toBe(false);
  });

  it("treats a null subtype or folder as an empty string rather than crashing", () => {
    const bare = { ...candidate, assetSubtype: null, folderId: null };
    expect(matchesCondition(bare, { field: "assetSubtype", operator: "contains", value: "ebook" })).toBe(false);
  });

  it("never matches on a blank condition value", () => {
    expect(matchesCondition(candidate, { field: "title", operator: "contains", value: "   " })).toBe(false);
  });
});

describe("brain rule matching", () => {
  it("requires every condition to hold", () => {
    const both = rule({ conditions: [
      { field: "originalName", operator: "contains", value: "makeup" },
      { field: "mimeType", operator: "equals", value: "application/pdf" }
    ] });
    expect(ruleMatches(candidate, both)).toBe(true);

    const oneWrong = rule({ conditions: [
      { field: "originalName", operator: "contains", value: "makeup" },
      { field: "mimeType", operator: "equals", value: "video/mp4" }
    ] });
    expect(ruleMatches(candidate, oneWrong)).toBe(false);
  });

  it("does not match when disabled", () => {
    expect(ruleMatches(candidate, rule({ enabled: false }))).toBe(false);
  });

  // A rule with no conditions is almost always half-finished; matching everything is the expensive
  // way to discover that.
  it("matches nothing when the rule has no conditions", () => {
    expect(ruleMatches(candidate, rule({ conditions: [] }))).toBe(false);
  });
});

describe("evaluateRules", () => {
  it("lets a lower priority number win field by field", () => {
    const broad = rule({ id: "broad", name: "Broad", priority: 100, actions: { stageId: "stage-1", surface: "learn" } });
    const narrow = rule({ id: "narrow", name: "Narrow", priority: 10, actions: { surface: "business" } });
    const result = evaluateRules(candidate, [broad, narrow]);
    expect(result.action.stageId).toBe("stage-1");
    expect(result.action.surface).toBe("business");
  });

  it("reports matched rule names strongest first", () => {
    const a = rule({ id: "a", name: "A", priority: 50 });
    const b = rule({ id: "b", name: "B", priority: 10 });
    expect(evaluateRules(candidate, [a, b]).matched).toEqual(["B", "A"]);
  });

  it("returns an empty action when nothing matches", () => {
    const result = evaluateRules(candidate, [rule({ conditions: [{ field: "originalName", operator: "contains", value: "toc" }] })]);
    expect(result.action).toEqual({});
    expect(result.matched).toEqual([]);
  });
});

describe("memory signals", () => {
  it("derives keys most-specific first and skips missing facts", () => {
    expect(computeSignalKeys(candidate)).toEqual(["subtype:ebook", "mime:application/pdf", "folder:folder-1"]);
    expect(computeSignalKeys({ ...candidate, assetSubtype: null, folderId: null })).toEqual(["mime:application/pdf"]);
  });

  it("picks the destination confirmed most often", () => {
    const signals: BrainMemorySignal[] = [
      { signalKey: "mime:application/pdf", stageId: "stage-2", nodeId: null, surface: "learn", evidenceCount: 5 },
      { signalKey: "subtype:ebook", stageId: "stage-3", nodeId: null, surface: null, evidenceCount: 2 }
    ];
    expect(pickFromMemory(computeSignalKeys(candidate), signals)?.stageId).toBe("stage-2");
  });

  it("breaks a tie toward the more specific key", () => {
    const signals: BrainMemorySignal[] = [
      { signalKey: "mime:application/pdf", stageId: "stage-2", nodeId: null, surface: null, evidenceCount: 3 },
      { signalKey: "subtype:ebook", stageId: "stage-3", nodeId: null, surface: null, evidenceCount: 3 }
    ];
    expect(pickFromMemory(computeSignalKeys(candidate), signals)?.stageId).toBe("stage-3");
  });

  it("ignores signals for keys this candidate does not have, and signals with no stage", () => {
    const signals: BrainMemorySignal[] = [
      { signalKey: "folder:other", stageId: "stage-9", nodeId: null, surface: null, evidenceCount: 99 },
      { signalKey: "subtype:ebook", stageId: null, nodeId: null, surface: null, evidenceCount: 50 }
    ];
    expect(pickFromMemory(computeSignalKeys(candidate), signals)).toBeNull();
  });

  it("grows confidence with evidence but stays below the rule score", () => {
    expect(memoryConfidence(1)).toBeCloseTo(0.35);
    expect(memoryConfidence(3)).toBeCloseTo(0.55);
    expect(memoryConfidence(500)).toBeLessThan(0.95);
  });
});

describe("buildSuggestion", () => {
  it("prefers a rule over memory", () => {
    const signals: BrainMemorySignal[] = [{ signalKey: "subtype:ebook", stageId: "stage-9", nodeId: null, surface: null, evidenceCount: 20 }];
    const result = buildSuggestion(candidate, [rule({})], signals);
    expect(result.source).toBe("rule");
    expect(result.stageId).toBe("stage-1");
  });

  it("falls back to memory when no rule names a stage", () => {
    const signals: BrainMemorySignal[] = [{ signalKey: "subtype:ebook", stageId: "stage-9", nodeId: "node-1", surface: "create", evidenceCount: 4 }];
    const result = buildSuggestion(candidate, [], signals);
    expect(result.source).toBe("memory");
    expect(result.stageId).toBe("stage-9");
    expect(result.nodeId).toBe("node-1");
  });

  // Inventing a destination for something the system has no basis to place would be worse than
  // admitting there isn't one — the item still belongs in the queue for a human to file.
  it("returns a manual draft with no stage when it knows nothing", () => {
    const result = buildSuggestion(candidate, [], []);
    expect(result.source).toBe("manual");
    expect(result.stageId).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("still carries a surface from a rule that matched but named no stage", () => {
    const surfaceOnly = rule({ actions: { surface: "business" } });
    const result = buildSuggestion(candidate, [surfaceOnly], []);
    expect(result.source).toBe("manual");
    expect(result.surface).toBe("business");
  });
});

describe("jsonb parsing", () => {
  // conditions/actions are jsonb, so a hand-edited row can contain anything. A broken rule must
  // match nothing rather than match wrongly.
  it("drops conditions with unknown fields, operators or empty values", () => {
    expect(toRuleConditions([
      { field: "title", operator: "contains", value: "ok" },
      { field: "nope", operator: "contains", value: "x" },
      { field: "title", operator: "regex", value: "x" },
      { field: "title", operator: "contains", value: "" },
      "not an object",
      null
    ])).toEqual([{ field: "title", operator: "contains", value: "ok" }]);
  });

  it("returns an empty list for a non-array", () => {
    expect(toRuleConditions({ field: "title" })).toEqual([]);
    expect(toRuleConditions(null)).toEqual([]);
  });

  it("keeps only recognised action fields", () => {
    expect(toRuleAction({ stageId: "s1", surface: "learn", nodeId: "", bogus: "x" })).toEqual({ stageId: "s1", surface: "learn" });
    expect(toRuleAction({ surface: "nowhere" })).toEqual({});
    expect(toRuleAction(null)).toEqual({});
  });
});
