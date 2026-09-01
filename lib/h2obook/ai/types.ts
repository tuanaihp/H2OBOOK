// Provider-agnostic shapes for the makeup-course AI coach. The UI and the API routes only ever see
// these — never a provider SDK type. AI output is always a DRAFT; the official score lives in
// class_evaluations and is never touched here.

export type AiProvider = "mock" | "gemini" | "openai" | "local-http" | "ollama";

/** One rubric criterion as frozen into a snapshot at analyze time. */
export interface AiRubricCriterion {
  id: string;
  label: string;
  maxScore: number;
  description?: string;
}

export interface AiCriterionScore {
  criterionId: string;
  score: number;
  maxScore: number;
  strength: string;
  issue: string;
  recommendation: string;
}

export interface AiAssessment {
  totalScore: number;
  maxScore: number;
  summary: string;
  priorityFixes: string[];
  criteria: AiCriterionScore[];
  provider: AiProvider;
  model: string | null;
  analyzedAt: string;
}

export interface AnalyzeInput {
  /** Stable seed so `mock` is deterministic per (session, student, attempt). */
  seed: string;
  rubric: AiRubricCriterion[];
  note: string;
  imageCount: number;
  /** Signed URLs — only the key-backed providers fetch these. */
  imageUrls: string[];
  sessionTitle: string;
  sessionType: string;
}

export interface CoachChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatInput {
  sessionTitle: string;
  rubric: AiRubricCriterion[];
  latestAssessment: AiAssessment | null;
  messages: CoachChatMessage[];
}

export interface AiChatReply {
  reply: string;
}
