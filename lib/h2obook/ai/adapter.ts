import "server-only";
import { geminiModel, isGeminiConfigured } from "@/lib/brain/providers/gemini";
import { mockAssessment, mockChat } from "./mock";
import type { AiAssessment, AiChatReply, AiProvider, AnalyzeInput, ChatInput } from "./types";

// One seam between "an AI draft" and "whatever produced it". AI is never required: every path
// degrades to `null` (route turns that into status:"unavailable") and the student's submission and
// the teacher's official score are never affected. Default provider is `mock` — deterministic,
// rubric-aware, no key.

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 25_000;

export function getAiProvider(): AiProvider {
  const raw = (process.env.H2O_AI_PROVIDER ?? "mock").trim().toLowerCase();
  if (raw === "gemini" || raw === "openai" || raw === "local-http" || raw === "ollama") return raw;
  return "mock";
}

export function describeAiProvider(): { provider: AiProvider; model: string | null; live: boolean } {
  const provider = getAiProvider();
  if (provider === "gemini") return { provider, model: isGeminiConfigured() ? geminiModel() : null, live: isGeminiConfigured() };
  if (provider === "local-http" || provider === "ollama") return { provider, model: null, live: Boolean(process.env.H2O_LOCAL_AI_URL?.trim()) };
  if (provider === "openai") return { provider, model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", live: Boolean(process.env.OPENAI_API_KEY?.trim()) };
  return { provider: "mock", model: "mock-heuristic", live: true };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 2) / 2;

// --- gemini ------------------------------------------------------------
const GEMINI_SCHEMA = {
  type: "object",
  properties: {
    totalScore: { type: "number" },
    summary: { type: "string" },
    priorityFixes: { type: "array", items: { type: "string" } },
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterionId: { type: "string" },
          score: { type: "number" },
          strength: { type: "string" },
          issue: { type: "string" },
          recommendation: { type: "string" },
        },
        required: ["criterionId", "score", "recommendation"],
      },
    },
  },
  required: ["totalScore", "summary", "criteria"],
} as const;

async function geminiAnalyze(input: AnalyzeInput): Promise<AiAssessment | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !input.rubric.length) return null;
  const model = geminiModel();
  const maxScore = input.rubric.reduce((s, c) => s + c.maxScore, 0) || 100;

  const prompt = [
    "Bạn là trợ giảng makeup người Việt. Chấm NHÁP bài thực hành của học viên theo đúng rubric giảng viên bên dưới.",
    "QUY TẮC: criterionId lấy nguyên văn từ rubric; score từ 0 đến maxScore của tiêu chí đó; không bịa tiêu chí mới.",
    "issue/recommendation ngắn gọn tiếng Việt. Nếu tiêu chí tốt thì issue để rỗng.",
    "",
    `Buổi học: ${input.sessionTitle} (${input.sessionType}). Số ảnh học viên nộp: ${input.imageCount}.`,
    `Ghi chú học viên: ${input.note || "(không có)"}`,
    "",
    "RUBRIC:",
    ...input.rubric.map((c) => `  - criterionId=${c.id} | ${c.label} | tối đa ${c.maxScore}đ${c.description ? ` | ${c.description}` : ""}`),
    "",
    "Trả về JSON đúng schema. totalScore là tổng các score.",
  ].join("\n");

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const url of input.imageUrls.slice(0, 4)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      parts.push({ inlineData: { mimeType: res.headers.get("content-type") ?? "image/jpeg", data: buf.toString("base64") } });
    } catch { /* skip unreachable image */ }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.25, responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA },
      }),
    });
    if (!response.ok) { console.error(`[h2o-ai] gemini analyze status ${response.status}`); return null; }
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") return null;
    const parsed = JSON.parse(text) as { totalScore?: number; summary?: string; priorityFixes?: string[]; criteria?: Array<Record<string, unknown>> };
    const byId = new Map(input.rubric.map((c) => [c.id, c]));
    const criteria = (parsed.criteria ?? [])
      .filter((c) => byId.has(String(c.criterionId)))
      .map((c) => {
        const rc = byId.get(String(c.criterionId))!;
        return {
          criterionId: rc.id,
          score: clamp(Number(c.score) || 0, 0, rc.maxScore),
          maxScore: rc.maxScore,
          strength: String(c.strength ?? ""),
          issue: String(c.issue ?? ""),
          recommendation: String(c.recommendation ?? ""),
        };
      });
    if (!criteria.length) return null;
    return {
      totalScore: round1(criteria.reduce((s, c) => s + c.score, 0)),
      maxScore,
      summary: String(parsed.summary ?? ""),
      priorityFixes: Array.isArray(parsed.priorityFixes) ? parsed.priorityFixes.map(String).slice(0, 5) : [],
      criteria,
      provider: "gemini",
      model,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[h2o-ai] gemini analyze errored:", error instanceof Error ? error.message : "unknown");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// --- local-http / ollama gateway ------------------------------------
async function localAnalyze(input: AnalyzeInput): Promise<AiAssessment | null> {
  const url = process.env.H2O_LOCAL_AI_URL?.trim();
  if (!url) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/v1/h2o/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({ rubric: input.rubric, note: input.note, imageUrls: input.imageUrls, sessionTitle: input.sessionTitle }),
    });
    if (!res.ok) return null;
    const raw = await res.json() as Partial<AiAssessment>;
    const byId = new Map(input.rubric.map((c) => [c.id, c]));
    const criteria = (raw.criteria ?? [])
      .filter((c) => byId.has(String(c.criterionId)))
      .map((c) => {
        const rc = byId.get(String(c.criterionId))!;
        return { criterionId: rc.id, score: clamp(Number(c.score) || 0, 0, rc.maxScore), maxScore: rc.maxScore, strength: String(c.strength ?? ""), issue: String(c.issue ?? ""), recommendation: String(c.recommendation ?? "") };
      });
    if (!criteria.length) return null;
    const maxScore = input.rubric.reduce((s, c) => s + c.maxScore, 0) || 100;
    return {
      totalScore: round1(criteria.reduce((s, c) => s + c.score, 0)),
      maxScore,
      summary: String(raw.summary ?? ""),
      priorityFixes: Array.isArray(raw.priorityFixes) ? raw.priorityFixes.map(String).slice(0, 5) : [],
      criteria,
      provider: getAiProvider(),
      model: raw.model ?? null,
      analyzedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function analyzeSubmission(input: AnalyzeInput): Promise<AiAssessment | null> {
  const provider = getAiProvider();
  if (provider === "gemini") return geminiAnalyze(input);
  if (provider === "local-http" || provider === "ollama") return localAnalyze(input);
  if (provider === "openai") return null; // TODO: openai branch when a key is provided
  return mockAssessment(input);
}

// --- coach chat -----------------------------------------------------
async function localChat(input: ChatInput): Promise<AiChatReply | null> {
  const url = process.env.H2O_LOCAL_AI_URL?.trim();
  if (!url) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/v1/h2o/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({ sessionTitle: input.sessionTitle, rubric: input.rubric, latestAssessment: input.latestAssessment, messages: input.messages }),
    });
    if (!res.ok) return null;
    const raw = await res.json() as { reply?: unknown };
    return typeof raw.reply === "string" ? { reply: raw.reply } : null;
  } catch {
    return null;
  }
}

async function geminiChat(input: ChatInput): Promise<AiChatReply | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = geminiModel();
  const sys = [
    `Bạn là H2O Learning Copilot — trợ giảng makeup người Việt cho buổi "${input.sessionTitle}".`,
    `Chỉ dựa trên rubric của buổi: ${input.rubric.map((r) => `${r.label} (${r.maxScore}đ)`).join(", ")}.`,
    input.latestAssessment ? `Điểm AI nháp gần nhất: ${input.latestAssessment.totalScore}/${input.latestAssessment.maxScore}. Ưu tiên sửa: ${input.latestAssessment.priorityFixes.join("; ")}.` : "Chưa có phân tích AI cho buổi này.",
    "Trả lời ngắn gọn, cụ thể, giọng coach thật. Không chấm điểm chính thức.",
  ].join("\n");
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: input.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.4 },
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" ? { reply: text } : null;
  } catch {
    return null;
  }
}

export async function chatWithCoach(input: ChatInput): Promise<AiChatReply | null> {
  const provider = getAiProvider();
  if (provider === "gemini") return geminiChat(input);
  if (provider === "local-http" || provider === "ollama") return localChat(input);
  if (provider === "openai") return null;
  return mockChat(input);
}
