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

export interface CoachMemoryFieldSchema {
  key: string;
  label: string;
  namespace: string;
  type: "text" | "number" | "boolean" | "select" | "multi_select" | "date" | "json";
  required?: boolean;
  requiresConfirmation?: boolean;
  description?: string;
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
  requiredFields: string[];
  questions: CoachQuestionRule[];
  tools: CoachToolBinding[];
  resultTemplate?: CoachResultTemplate;
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

export interface CoachTurnResult {
  reply: string;
  candidates: CoachCandidateExtraction[];
  nextQuestion?: string | null;
  completionHints?: string[];
  referencedResourceIds?: string[];
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
