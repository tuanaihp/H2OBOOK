import "server-only";
import type { AiTaxonomy } from "./ai-parse";
import { geminiModel, isGeminiConfigured, MAX_BATCH, requestGeminiSuggestions } from "./providers/gemini";
import type { BrainCandidate, BrainSuggestionDraft } from "./types";

// The seam between "a suggestion" and "whatever produced it". Today the only AI provider is Gemini;
// adding another means adding a branch here, not touching the queue, the rules or the UI.
//
// AI is never required. Every function below degrades to "no suggestion from AI" when no key is
// configured or the call fails, and the caller always already holds a rule/precedent-based fallback.

export interface AiStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
}

export function describeAi(): AiStatus {
  if (isGeminiConfigured()) return { configured: true, provider: "gemini", model: geminiModel() };
  return { configured: false, provider: null, model: null };
}

/**
 * The block of text describing one asset to the model. Kept in one place so the prompt can never
 * quietly start including something the rule engine cannot see — if a fact is worth showing the AI,
 * it belongs on BrainCandidate, where rules can match on it too.
 */
export function describeCandidate(candidate: BrainCandidate): string {
  const lines = [
    `    tên file: ${candidate.originalName || "(không có)"}`,
    `    tiêu đề: ${candidate.title || "(chưa đặt)"}`,
    `    loại: ${candidate.mimeType || "(không rõ)"}${candidate.assetSubtype ? ` · ${candidate.assetSubtype}` : ""}`
  ];
  if (candidate.folderName) lines.push(`    thư mục: ${candidate.folderName}`);
  if (candidate.tags?.length) lines.push(`    thẻ: ${candidate.tags.join(", ")}`);
  if (candidate.description) lines.push(`    mô tả: ${candidate.description.slice(0, 400)}`);
  return lines.join("\n");
}

/**
 * Asks the configured provider to classify a batch, in chunks it can handle. Chunks run in sequence
 * rather than in parallel so a large drop cannot fan out into a burst of concurrent requests against
 * a rate limit.
 */
export async function requestAiSuggestions(candidates: BrainCandidate[], taxonomy: AiTaxonomy): Promise<Map<string, BrainSuggestionDraft>> {
  const merged = new Map<string, BrainSuggestionDraft>();
  if (!isGeminiConfigured() || !candidates.length || !taxonomy.stages.length) return merged;

  for (let start = 0; start < candidates.length; start += MAX_BATCH) {
    const chunk = candidates.slice(start, start + MAX_BATCH);
    const result = await requestGeminiSuggestions({ candidates: chunk, taxonomy, describe: describeCandidate });
    for (const [assetId, draft] of result) merged.set(assetId, draft);
  }
  return merged;
}
