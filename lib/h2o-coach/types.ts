// No "server-only" import here on purpose — offline-engine.ts's pure functions must be Vitest-
// importable, same reason lib/mission-workspace/completion.ts and lib/learning-journey/metrics.ts
// have no server dependency. Field/type names track the source package (v5/39-H2OBOOK_H2O_COACH_OS_V1)
// but every id below is a real H2OBOOK uuid at runtime, never a synthetic reference-schema id.

export type CoachProviderMode = "offline" | "hybrid" | "ai";
export type CoachVersionStatus = "draft" | "published" | "archived";
export type MemoryValueStatus = "proposed" | "confirmed" | "rejected";

export interface CoachKnowledgeScope {
  resourceIds: string[];
  allowMissionBindings: boolean;
  allowStageCurriculum: boolean;
  allowCrossStage?: boolean;
}

export interface CoachExtractionRule {
  /** Matched case-insensitively as a substring of the learner's raw message — deterministic, not fuzzy/AI. */
  pattern: string;
  /** The canonical value written to memory when `pattern` matches (e.g. pattern "cô dâu" -> value "Bridal Makeup"). */
  value: string;
}

export interface CoachMemoryFieldSchema {
  key: string;
  label: string;
  namespace: string;
  type: "text" | "number" | "boolean" | "select" | "multi_select" | "date" | "json";
  required?: boolean;
  requiresConfirmation?: boolean;
  description?: string;
  /**
   * Offline-mode extraction rules — the only way a free-text message becomes a structured value when
   * no AI provider is configured. Without these, offline mode can only ever notice a field is
   * "missing," never fill it in from what the learner actually typed (the exact bug found in real
   * production data 2026-08-15: offline-mode Coach asked the same question forever because it had
   * zero text-understanding capability, by original design). A field with no rules stays offline-
   * unfillable until an admin configures them, or until AI/Hybrid mode is turned on for that Stage.
   */
  extractionRules?: CoachExtractionRule[];
}

export interface CoachStageProfile {
  id: string;
  organizationId: string;
  stageId: string;
  currentPublishedVersionId: string | null;
}

export interface CoachStageProfileVersion {
  id: string;
  organizationId: string;
  profileId: string;
  versionNumber: number;
  status: CoachVersionStatus;
  name: string;
  coachRole: string;
  systemTone: string;
  providerMode: CoachProviderMode;
  knowledgeScope: CoachKnowledgeScope;
  memorySchema: CoachMemoryFieldSchema[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoachCondition {
  field: string;
  op: "missing" | "present" | "eq" | "neq" | "contains";
  value?: unknown;
}

export interface CoachQuestionRule {
  id: string;
  when: CoachCondition[];
  prompt: string;
  targetField?: string;
  priority: number;
}

export interface CoachToolBinding {
  toolKey: string;
  label: string;
  href?: string;
  required?: boolean;
}

export interface CoachResultTemplate {
  resultType: string;
  title: string;
  fieldMap: Record<string, string>;
}

export interface MissionCoachConfig {
  id: string;
  missionId: string;
  profileVersionId: string;
  objective: string;
  /** Admin-internal behavior guidance (tone, do/don't) — distinct from `objective`, which is the student-facing framing of what the Mission is for. Folds into the system prompt, never shown to the learner as-is. */
  coachInstructions: string;
  requiredFields: string[];
  questions: CoachQuestionRule[];
  tools: CoachToolBinding[];
  resultTemplate?: CoachResultTemplate;
  /** Free-form grading criteria an admin defines for this Mission — surfaced to the Coach for context, never used to auto-score; only informs its language. */
  rubric: Record<string, unknown>;
  /** Structured evidence expectations (e.g. "1 ảnh trước/sau") beyond the free-text evidence the 4-tab Mission Workspace already collects — advisory to the Coach, not a second evidence-collection mechanism. */
  evidenceRequirements: Record<string, unknown>[];
}

export interface LearnerMemoryValue {
  id?: string;
  field: string;
  namespace: string;
  value: unknown;
  status: MemoryValueStatus;
  confidence?: number | null;
  sourceMissionId?: string | null;
  sourceMessageId?: string | null;
  updatedAt: string;
}

export interface CoachConversationMessage {
  id: string;
  role: "coach" | "learner" | "system";
  text: string;
  createdAt: string;
  /** Client-generated id for the learner's own message, echoed back so a retried request (double
   * click, React StrictMode, network retry) can be recognized as the same message rather than
   * processed twice — never set on coach/system messages. */
  clientMessageId?: string;
}

export interface CoachCandidateExtraction {
  field: string;
  value: unknown;
  confidence: number;
  rationale?: string;
  requiresConfirmation: boolean;
}

export interface CoachRuntimeContext {
  organizationId: string;
  learnerId: string;
  stageId: string;
  missionId: string;
  profile: CoachStageProfileVersion;
  missionConfig: MissionCoachConfig;
  memory: LearnerMemoryValue[];
}

/**
 * `in_progress`: at least one required field still missing. `awaiting_confirmation`: every required
 * field has a value, waiting on the learner's explicit yes/no to the summary. `confirmed`: learner
 * confirmed — this is the only state that may trigger the canonical Mission completion resolver.
 * Never inferred from conversation text alone; always derived from real memory rows (STEP 3/STEP 8).
 */
export type CoachMissionState = "in_progress" | "awaiting_confirmation" | "confirmed";

export interface CoachTurnResult {
  reply: string;
  candidates: CoachCandidateExtraction[];
  nextQuestion?: string | null;
  completionHints?: string[];
  referencedResourceIds?: string[];
  missionState: CoachMissionState;
  progressPercent: number;
}

/**
 * Mission-level "learner confirmed the summary" is stored as one more learner_memory_values row
 * under a synthetic, well-defined key — not a new table/column. namespace "mission" can never collide
 * with a real Stage-declared namespace (career/style/skill/...), and the key is unique per Mission so
 * two Missions on the same Stage never share a confirmation flag.
 */
export function missionConfirmedFieldKey(missionId: string): string {
  return `mission.${missionId}.confirmed`;
}

/**
 * knowledge_scope's DB default is bare '{}'::jsonb (migration 0057) — a version created without an
 * explicit value (e.g. admin.ts's getOrCreateProfile first draft) has no resourceIds/
 * allowMissionBindings/allowStageCurriculum keys at all, not just falsy ones. `?? fallback` only
 * catches null/undefined, not an incomplete object — every reader (admin.ts, repository.ts) must go
 * through this instead of null-coalescing the raw column directly, or a fresh unconfigured draft
 * crashes the moment its Knowledge tab renders (`resourceIds.join(...)` on undefined — found in real
 * production data 2026-08-15).
 */
export function normalizeKnowledgeScope(value: Partial<CoachKnowledgeScope> | null | undefined): CoachKnowledgeScope {
  return { resourceIds: value?.resourceIds ?? [], allowMissionBindings: value?.allowMissionBindings ?? true, allowStageCurriculum: value?.allowStageCurriculum ?? true };
}
