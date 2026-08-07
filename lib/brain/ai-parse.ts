// Parsing and validating what the model sends back. Pure, so it can be tested without a network
// call — and it needs to be tested, because this is the layer that decides how much a model's
// output is allowed to affect the curriculum.
//
// The rule throughout: anything the model returns that does not correspond to something real is
// dropped, never repaired by guessing. A hallucinated stage id must become "no suggestion", not a
// different stage.

import type { StageSurface } from "@/lib/academy-control/types";
import type { BrainSuggestionDraft } from "./types";

export interface TaxonomyStage { id: string; title: string }
export interface TaxonomyNode { id: string; stageId: string; title: string; nodeType: string }

export interface AiTaxonomy {
  stages: TaxonomyStage[];
  nodes: TaxonomyNode[];
}

const SURFACES = new Set(["learn", "create", "business", "coaching"]);
const MAX_REASON_LENGTH = 300;

function clampConfidence(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), 1);
}

/**
 * Turns one model item into a draft, or null if it cannot be trusted.
 *
 * A node is only kept when it belongs to the stage that was chosen: a model that picks a plausible
 * stage and a plausible module from a different stage would otherwise file the document somewhere
 * that reads correctly in the API and wrong in the tree.
 */
export function parseAiItem(raw: unknown, taxonomy: AiTaxonomy, modelLabel: string): { assetId: string; draft: BrainSuggestionDraft } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const assetId = typeof item.assetId === "string" ? item.assetId.trim() : "";
  if (!assetId) return null;

  const stage = taxonomy.stages.find((candidate) => candidate.id === item.stageId);
  const node = stage ? taxonomy.nodes.find((candidate) => candidate.id === item.nodeId && candidate.stageId === stage.id) : undefined;
  const surface = typeof item.surface === "string" && SURFACES.has(item.surface) ? (item.surface as StageSurface) : null;

  const reasonText = typeof item.reason === "string" ? item.reason.trim().slice(0, MAX_REASON_LENGTH) : "";
  // Confidence is meaningless without a destination — an item with no valid stage is a manual one
  // no matter how sure the model claimed to be.
  const confidence = stage ? clampConfidence(item.confidence) : 0;

  return {
    assetId,
    draft: {
      source: stage ? "ai" : "manual",
      stageId: stage?.id ?? null,
      nodeId: node?.id ?? null,
      surface,
      confidence,
      reason: stage
        ? `AI (${modelLabel}): ${reasonText || "không nêu lý do"}`
        : `AI (${modelLabel}) không xác định được giai đoạn phù hợp${reasonText ? ` — ${reasonText}` : ""}`
    }
  };
}

/**
 * Maps a whole model response by assetId rather than by array position. Position matching breaks
 * silently when the model returns items in a different order or skips one; keying by id means a
 * missing or unrecognised entry simply has no suggestion, which the caller already handles.
 */
export function parseAiResponse(raw: unknown, taxonomy: AiTaxonomy, modelLabel: string): Map<string, BrainSuggestionDraft> {
  const result = new Map<string, BrainSuggestionDraft>();
  if (typeof raw !== "object" || raw === null) return result;
  const items = (raw as Record<string, unknown>).items;
  if (!Array.isArray(items)) return result;
  for (const entry of items) {
    const parsed = parseAiItem(entry, taxonomy, modelLabel);
    if (parsed && !result.has(parsed.assetId)) result.set(parsed.assetId, parsed.draft);
  }
  return result;
}

/**
 * Pulls the JSON payload out of a Gemini response. The API is asked for JSON via responseMimeType,
 * but a refusal or a truncated generation still comes back shaped like a normal candidate, so this
 * has to tolerate text that is not JSON at all.
 */
export function extractGeminiJson(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) return null;
  const candidates = (payload as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0] as Record<string, unknown> | undefined;
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((part) => (typeof part === "object" && part !== null ? String((part as Record<string, unknown>).text ?? "") : "")).join("");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
