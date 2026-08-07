import "server-only";
import { extractGeminiJson, parseAiResponse, type AiTaxonomy } from "../ai-parse";
import type { BrainCandidate, BrainSuggestionDraft } from "../types";

// Gemini as one source of suggestions — never the only one, and never required. The key lives in an
// environment variable like every other third-party credential in this repo (EMAIL_API_KEY,
// PAYMENT_WEBHOOK_SECRET); nothing about it is stored in Postgres or sent to the browser.

const DEFAULT_MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 30_000;
/** One request per batch instead of one per asset. Filing thirty files at once is the normal case. */
export const MAX_BATCH = 25;

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** What the model is allowed to answer. Constraining the shape here is what makes the reply parseable. */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          assetId: { type: "string" },
          stageId: { type: "string", nullable: true },
          nodeId: { type: "string", nullable: true },
          surface: { type: "string", nullable: true, enum: ["learn", "create", "business", "coaching"] },
          confidence: { type: "number" },
          reason: { type: "string" }
        },
        required: ["assetId", "confidence", "reason"]
      }
    }
  },
  required: ["items"]
} as const;

function buildPrompt(candidates: BrainCandidate[], taxonomy: AiTaxonomy, describe: (candidate: BrainCandidate) => string): string {
  const stageLines = taxonomy.stages.map((stage) => {
    const nodes = taxonomy.nodes.filter((node) => node.stageId === stage.id);
    const nodeText = nodes.length ? nodes.map((node) => `      - ${node.id} · ${node.title} (${node.nodeType})`).join("\n") : "      (chưa có chương trình nào)";
    return `  - stageId: ${stage.id}\n    tên: ${stage.title}\n    các mục bên trong:\n${nodeText}`;
  }).join("\n");

  const assetLines = candidates.map((candidate) => `  - assetId: ${candidate.assetId}\n${describe(candidate)}`).join("\n");

  return [
    "Bạn là trợ lý phân loại tài liệu cho một học viện dạy nghề làm đẹp tại Việt Nam.",
    "Nhiệm vụ: với mỗi tài liệu, chọn giai đoạn học phù hợp nhất trong danh sách bên dưới.",
    "",
    "QUY TẮC BẮT BUỘC:",
    "1. stageId và nodeId PHẢI lấy nguyên văn từ danh sách bên dưới. Tuyệt đối không tự bịa id.",
    "2. nodeId phải thuộc đúng stageId bạn đã chọn. Nếu không chắc, để nodeId là null.",
    "3. Nếu không đủ căn cứ để chọn giai đoạn, đặt stageId là null. Đoán bừa gây hại hơn là bỏ trống.",
    "4. confidence từ 0 đến 1, phản ánh mức chắc chắn thật sự của bạn.",
    "5. reason viết bằng tiếng Việt, tối đa 2 câu, nêu rõ bạn dựa vào đâu.",
    "6. Bạn CHỈ nhìn thấy phần mô tả (tên file, tiêu đề, thư mục, thẻ) — KHÔNG đọc được nội dung bên trong file. Đừng suy đoán về nội dung mà mô tả không nói tới.",
    "",
    "CÁC GIAI ĐOẠN HIỆN CÓ:",
    stageLines || "  (chưa có giai đoạn nào)",
    "",
    "CÁC TÀI LIỆU CẦN PHÂN LOẠI:",
    assetLines,
    "",
    "Trả lời đúng định dạng JSON đã quy định, mỗi assetId đúng một mục."
  ].join("\n");
}

export interface GeminiRequest {
  candidates: BrainCandidate[];
  taxonomy: AiTaxonomy;
  describe: (candidate: BrainCandidate) => string;
}

/**
 * Returns a suggestion per asset, or an empty map on any failure.
 *
 * Failure is deliberately quiet: the caller has already produced a fallback suggestion from rules
 * and precedent, and an unreachable model, an expired key or a rate limit must never stop an admin
 * from queueing documents. The error is logged for the operator, not raised at the user.
 */
export async function requestGeminiSuggestions(input: GeminiRequest): Promise<Map<string, BrainSuggestionDraft>> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !input.candidates.length) return new Map();

  const model = geminiModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(input.candidates, input.taxonomy, input.describe) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA
        }
      })
    });

    if (!response.ok) {
      // The body can contain the key in an echoed request on some error paths, so only the status
      // is logged.
      console.error(`[h2o-brain] Gemini request failed with status ${response.status}`);
      return new Map();
    }

    return parseAiResponse(extractGeminiJson(await response.json()), input.taxonomy, model);
  } catch (error) {
    console.error("[h2o-brain] Gemini request errored:", error instanceof Error ? error.message : "unknown error");
    return new Map();
  } finally {
    clearTimeout(timeout);
  }
}
