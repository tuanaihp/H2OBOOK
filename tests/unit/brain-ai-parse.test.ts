import { describe, expect, it } from "vitest";
import { extractGeminiJson, parseAiItem, parseAiResponse, type AiTaxonomy } from "@/lib/brain/ai-parse";

// This layer decides how much a model's output is allowed to affect the curriculum. Everything it
// cannot verify against the real taxonomy has to be dropped rather than repaired by guessing.

const taxonomy: AiTaxonomy = {
  stages: [{ id: "stage-1", title: "Người mới bắt đầu" }, { id: "stage-2", title: "Thợ chính" }],
  nodes: [
    { id: "node-1", stageId: "stage-1", title: "Nền tảng Makeup", nodeType: "program" },
    { id: "node-2", stageId: "stage-2", title: "Kỹ thuật nâng cao", nodeType: "program" }
  ]
};

function geminiPayload(body: unknown) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] };
}

describe("parseAiItem", () => {
  it("accepts a well-formed item", () => {
    const parsed = parseAiItem({ assetId: "a1", stageId: "stage-1", nodeId: "node-1", surface: "learn", confidence: 0.8, reason: "Tên file nói về makeup cơ bản" }, taxonomy, "gemini-test");
    expect(parsed?.draft.source).toBe("ai");
    expect(parsed?.draft.stageId).toBe("stage-1");
    expect(parsed?.draft.nodeId).toBe("node-1");
    expect(parsed?.draft.surface).toBe("learn");
    expect(parsed?.draft.confidence).toBe(0.8);
    expect(parsed?.draft.reason).toContain("gemini-test");
  });

  // The failure that matters most: a model naming a stage that does not exist must not place the
  // document anywhere at all.
  it("drops a hallucinated stage id and falls back to manual", () => {
    const parsed = parseAiItem({ assetId: "a1", stageId: "stage-999", confidence: 0.99, reason: "chắc chắn" }, taxonomy, "m");
    expect(parsed?.draft.source).toBe("manual");
    expect(parsed?.draft.stageId).toBeNull();
    expect(parsed?.draft.confidence).toBe(0);
  });

  // A plausible stage plus a module from a different stage would read correctly in the API and file
  // the document in the wrong branch of the tree.
  it("drops a node that belongs to a different stage", () => {
    const parsed = parseAiItem({ assetId: "a1", stageId: "stage-1", nodeId: "node-2", confidence: 0.7, reason: "x" }, taxonomy, "m");
    expect(parsed?.draft.stageId).toBe("stage-1");
    expect(parsed?.draft.nodeId).toBeNull();
  });

  it("drops an unknown surface", () => {
    const parsed = parseAiItem({ assetId: "a1", stageId: "stage-1", surface: "marketing", confidence: 0.5, reason: "x" }, taxonomy, "m");
    expect(parsed?.draft.surface).toBeNull();
  });

  it("clamps confidence into range and survives a non-numeric value", () => {
    expect(parseAiItem({ assetId: "a", stageId: "stage-1", confidence: 7, reason: "" }, taxonomy, "m")?.draft.confidence).toBe(1);
    expect(parseAiItem({ assetId: "a", stageId: "stage-1", confidence: -3, reason: "" }, taxonomy, "m")?.draft.confidence).toBe(0);
    expect(parseAiItem({ assetId: "a", stageId: "stage-1", confidence: "nhiều", reason: "" }, taxonomy, "m")?.draft.confidence).toBe(0);
  });

  it("rejects an item with no assetId", () => {
    expect(parseAiItem({ stageId: "stage-1", confidence: 1, reason: "x" }, taxonomy, "m")).toBeNull();
    expect(parseAiItem({ assetId: "   ", stageId: "stage-1" }, taxonomy, "m")).toBeNull();
    expect(parseAiItem(null, taxonomy, "m")).toBeNull();
    expect(parseAiItem("a string", taxonomy, "m")).toBeNull();
  });

  it("truncates an overlong reason", () => {
    const parsed = parseAiItem({ assetId: "a", stageId: "stage-1", confidence: 0.5, reason: "x".repeat(1000) }, taxonomy, "m");
    expect(parsed!.draft.reason.length).toBeLessThan(400);
  });
});

describe("parseAiResponse", () => {
  it("keys results by assetId rather than array position", () => {
    const result = parseAiResponse({ items: [
      { assetId: "b", stageId: "stage-2", confidence: 0.6, reason: "hai" },
      { assetId: "a", stageId: "stage-1", confidence: 0.9, reason: "một" }
    ] }, taxonomy, "m");
    expect(result.get("a")?.stageId).toBe("stage-1");
    expect(result.get("b")?.stageId).toBe("stage-2");
  });

  it("keeps the first entry when the model repeats an assetId", () => {
    const result = parseAiResponse({ items: [
      { assetId: "a", stageId: "stage-1", confidence: 0.9, reason: "đầu" },
      { assetId: "a", stageId: "stage-2", confidence: 0.9, reason: "sau" }
    ] }, taxonomy, "m");
    expect(result.get("a")?.stageId).toBe("stage-1");
  });

  it("returns an empty map for malformed payloads", () => {
    expect(parseAiResponse(null, taxonomy, "m").size).toBe(0);
    expect(parseAiResponse({}, taxonomy, "m").size).toBe(0);
    expect(parseAiResponse({ items: "nope" }, taxonomy, "m").size).toBe(0);
  });
});

describe("extractGeminiJson", () => {
  it("reads the JSON out of a normal response", () => {
    expect(extractGeminiJson(geminiPayload({ items: [] }))).toEqual({ items: [] });
  });

  it("joins multi-part text before parsing", () => {
    const payload = { candidates: [{ content: { parts: [{ text: '{"items":' }, { text: "[]}" }] } }] };
    expect(extractGeminiJson(payload)).toEqual({ items: [] });
  });

  // A refusal or a truncated generation comes back shaped like a normal candidate but is not JSON.
  it("returns null rather than throwing on text that is not JSON", () => {
    expect(extractGeminiJson({ candidates: [{ content: { parts: [{ text: "Xin lỗi, tôi không thể." }] } }] })).toBeNull();
    expect(extractGeminiJson({ candidates: [] })).toBeNull();
    expect(extractGeminiJson({})).toBeNull();
    expect(extractGeminiJson(null)).toBeNull();
  });
});
