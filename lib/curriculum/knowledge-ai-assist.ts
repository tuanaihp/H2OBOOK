import "server-only";
import { getDecryptedProviderKey } from "@/lib/enterprise/ai-providers";
import { geminiModel } from "@/lib/brain/providers/gemini";

/**
 * "AI phân tích tài liệu" — optional. Reuses whichever provider key the organization has configured
 * in Cổng API (lib/enterprise/ai-providers.ts), never a hardcoded env var — this is exactly the
 * "gateway seam" that module's own doc comment said nothing called yet. Gracefully returns null when
 * no key is configured (or the call fails), same "AI is never required" contract every other
 * AI-backed feature in this repo follows; the caller always already has the deterministic extracted
 * text as a real fallback.
 *
 * AI only SUGGESTS metadata (title/summary/docType/skillCode) and a cleaned-up body — it never saves
 * or publishes anything itself (§10 "AI không tự publish" — an admin still reviews and explicitly
 * saves the draft, then explicitly publishes).
 */
export interface KnowledgeAiSuggestion {
  title: string;
  summary: string;
  docType: string;
  skillCode: string | null;
  bodyMarkdown: string;
}

const ALLOWED_DOC_TYPES = ["article", "checklist", "rubric", "practice", "worksheet", "template", "assessment", "case_study", "sop", "script", "tool_guide", "playbook", "assignment"];

function buildPrompt(rawText: string): string {
  return [
    "Bạn đang giúp Admin học viện làm đẹp tổ chức lại một tài liệu thô thành 1 bài kiến thức đào tạo (Knowledge Unit) chính thức.",
    "",
    "QUY TẮC:",
    `1. docType PHẢI là một trong các giá trị sau, nguyên văn: ${ALLOWED_DOC_TYPES.join(", ")}.`,
    "2. skillCode: mã kỹ năng ngắn gọn viết hoa (vd SKIN_PREP), hoặc null nếu không rõ.",
    "3. bodyMarkdown: viết lại nội dung gốc cho rõ ràng, mạch lạc bằng markdown — KHÔNG bịa thêm thông tin không có trong tài liệu gốc.",
    "4. title/summary ngắn gọn, tiếng Việt.",
    "",
    "TÀI LIỆU GỐC:",
    rawText.slice(0, 20000),
    "",
    "Trả lời đúng định dạng JSON đã quy định."
  ].join("\n");
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" }, summary: { type: "string" }, docType: { type: "string" },
    skillCode: { type: "string", nullable: true }, bodyMarkdown: { type: "string" }
  },
  required: ["title", "summary", "docType", "bodyMarkdown"]
} as const;

async function suggestViaGemini(apiKey: string, rawText: string): Promise<KnowledgeAiSuggestion | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, signal: controller.signal,
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: buildPrompt(rawText) }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA } })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") return null;
    return normalize(JSON.parse(text));
  } catch { return null; } finally { clearTimeout(timeout); }
}

async function suggestViaOpenAi(apiKey: string, rawText: string): Promise<KnowledgeAiSuggestion | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, signal: controller.signal,
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "user", content: buildPrompt(rawText) }] })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;
    return normalize(JSON.parse(text));
  } catch { return null; } finally { clearTimeout(timeout); }
}

function normalize(raw: unknown): KnowledgeAiSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.title !== "string" || typeof r.bodyMarkdown !== "string") return null;
  const docType = ALLOWED_DOC_TYPES.includes(String(r.docType)) ? String(r.docType) : "article";
  return { title: r.title, summary: typeof r.summary === "string" ? r.summary : "", docType, skillCode: typeof r.skillCode === "string" && r.skillCode.trim() ? r.skillCode.trim() : null, bodyMarkdown: r.bodyMarkdown };
}

/** Tries Gemini first, then OpenAI — whichever the organization has actually configured in Cổng API. Returns null (not an error) when neither is configured; the caller already has the deterministic extracted text as a real fallback. */
export async function suggestKnowledgeFromText(organizationId: string, rawText: string): Promise<KnowledgeAiSuggestion | null> {
  if (!rawText.trim()) return null;
  const geminiKey = await getDecryptedProviderKey(organizationId, "gemini");
  if (geminiKey) { const result = await suggestViaGemini(geminiKey, rawText); if (result) return result; }
  const openAiKey = await getDecryptedProviderKey(organizationId, "openai");
  if (openAiKey) { const result = await suggestViaOpenAi(openAiKey, rawText); if (result) return result; }
  return null;
}
