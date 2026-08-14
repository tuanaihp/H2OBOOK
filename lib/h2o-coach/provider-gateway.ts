import "server-only";
import { isGeminiConfigured, geminiModel } from "@/lib/brain/providers/gemini";
import type { CoachCandidateExtraction, CoachRuntimeContext, CoachTurnResult } from "./types";

// Reuses the exact low-level Gemini call convention lib/brain/providers/gemini.ts already
// established for H2O Brain's asset classifier (server-only fetch, JSON responseSchema, same
// GEMINI_API_KEY, same graceful "not configured" degrade) — a second provider abstraction was
// deliberately not built. Not configured in this deployment today (docs/h2o-coach-v1/
// 01_PRODUCTION_AUDIT.md §1): isGeminiConfigured() reports false, so hybrid/ai providerMode falls
// back to the offline engine until a key is added — the same behavior every other Gemini-backed
// feature in this repo already has.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20_000;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    nextQuestion: { type: "string", nullable: true },
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          value: { type: "string" },
          confidence: { type: "number" },
          rationale: { type: "string" }
        },
        required: ["field", "value", "confidence"]
      }
    }
  },
  required: ["reply", "candidates"]
} as const;

export function isCoachAiConfigured(): boolean {
  return isGeminiConfigured();
}

function buildPrompt(ctx: CoachRuntimeContext, learnerMessage: string, knowledge: Array<{ title: string; excerpt?: string }>): string {
  const confirmed = ctx.memory.filter((m) => m.status === "confirmed").map((m) => `  - ${m.field} = ${JSON.stringify(m.value)}`).join("\n") || "  (chưa có)";
  const schemaFields = ctx.profile.memorySchema.map((f) => `  - ${f.key} (${f.namespace}, ${f.type}${f.requiresConfirmation ? ", cần xác nhận" : ""}): ${f.label}`).join("\n") || "  (chưa cấu hình field nào)";
  const knowledgeLines = knowledge.map((k) => `  - ${k.title}${k.excerpt ? `: ${k.excerpt.slice(0, 300)}` : ""}`).join("\n") || "  (không có tài liệu grounding)";

  return [
    `Bạn là ${ctx.profile.coachRole || "H2O Coach"}, huấn luyện viên cho học viên nghề Makeup người Việt.`,
    ctx.profile.systemTone ? `Phong cách: ${ctx.profile.systemTone}` : "",
    `Mục tiêu Mission hiện tại: ${ctx.missionConfig.objective || "(chưa mô tả)"}`,
    "",
    "QUY TẮC BẮT BUỘC:",
    "1. field trong candidates PHẢI lấy nguyên văn từ danh sách field bên dưới. Tuyệt đối không tự bịa field key mới.",
    "2. Không hỏi lại field đã có trong DỮ LIỆU ĐÃ XÁC NHẬN.",
    "3. confidence từ 0 đến 1, phản ánh mức chắc chắn thật sự dựa trên đúng những gì học viên vừa nói — không suy đoán quá xa.",
    "4. Chỉ đề xuất candidate cho field học viên vừa thực sự cung cấp thông tin trong tin nhắn này.",
    "5. reply và nextQuestion viết bằng tiếng Việt, giọng gần gũi như một coach thật, ngắn gọn.",
    "",
    "CÁC FIELD ĐƯỢC PHÉP ĐỀ XUẤT:",
    schemaFields,
    "",
    "DỮ LIỆU ĐÃ XÁC NHẬN (không hỏi lại):",
    confirmed,
    "",
    "TÀI LIỆU GROUNDING (chỉ dùng nội dung này, không tự suy diễn ngoài phạm vi):",
    knowledgeLines,
    "",
    `TIN NHẮN HỌC VIÊN: "${learnerMessage}"`,
    "",
    "Trả lời đúng định dạng JSON đã quy định."
  ].filter(Boolean).join("\n");
}

/**
 * Structured turn generation. Never called unless isCoachAiConfigured() is true — the caller
 * (lib/h2o-coach/service.ts) always has the deterministic offline engine as its fallback, so a
 * missing key, a timeout or a malformed response degrades to "no AI turn" quietly, same contract
 * requestGeminiSuggestions() already follows for Brain.
 */
export async function generateCoachTurn(args: {
  context: CoachRuntimeContext;
  learnerMessage: string;
  knowledge: Array<{ id: string; title: string; excerpt?: string }>;
}): Promise<CoachTurnResult | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = geminiModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(args.context, args.learnerMessage, args.knowledge) }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA }
      })
    });
    if (!response.ok) { console.error(`[h2o-coach] Gemini request failed with status ${response.status}`); return null; }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") return null;
    const parsed = JSON.parse(text) as { reply?: string; nextQuestion?: string | null; candidates?: unknown[] };
    if (typeof parsed.reply !== "string") return null;

    const allowedFields = new Set(args.context.profile.memorySchema.map((f) => f.key));
    const requiresConfirmation = new Map(args.context.profile.memorySchema.map((f) => [f.key, f.requiresConfirmation ?? true]));
    const candidates: CoachCandidateExtraction[] = (Array.isArray(parsed.candidates) ? parsed.candidates : [])
      .filter((c): c is { field: string; value: string; confidence: number; rationale?: string } =>
        Boolean(c && typeof c === "object" && "field" in c && allowedFields.has(String((c as { field: unknown }).field))))
      .map((c) => ({
        field: c.field, value: c.value, confidence: Math.min(1, Math.max(0, Number(c.confidence) || 0)),
        rationale: c.rationale, requiresConfirmation: requiresConfirmation.get(c.field) ?? true
      }));

    return { reply: parsed.reply, candidates, nextQuestion: parsed.nextQuestion ?? null, referencedResourceIds: args.knowledge.map((k) => k.id) };
  } catch (error) {
    console.error("[h2o-coach] Gemini request errored:", error instanceof Error ? error.message : "unknown error");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
