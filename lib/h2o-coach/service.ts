import "server-only";
import { runOfflineCoachTurn } from "./offline-engine";
import { generateCoachTurn, isCoachAiConfigured } from "./provider-gateway";
import { appendConversation, getConversation, getKnowledgeContext, getRuntimeContext, resolveStageIdForMission } from "./repository";
import { saveProposedMemory } from "./memory";
import type { CoachCandidateExtraction, CoachConversationMessage, CoachTurnResult } from "./types";

function candidateToMemoryValue(candidate: CoachCandidateExtraction, messageId: string) {
  return {
    field: candidate.field, value: candidate.value,
    status: candidate.requiresConfirmation ? ("proposed" as const) : ("confirmed" as const),
    confidence: candidate.confidence, sourceMessageId: messageId
  };
}

export interface CoachTurnOutcome extends CoachTurnResult { missionId: string; usedAi: boolean }
type CoachResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * One learner message in, one Coach reply out. Offline is always the fallback — a missing/expired
 * key, a timeout or a malformed model response degrades to the deterministic rule engine rather than
 * failing the turn, same "AI is never required" contract lib/brain/ai.ts already follows.
 * Readiness != Completion still holds here: this function only proposes/confirms memory fields, it
 * never touches student_mission_states or calls the canonical completion resolver.
 */
export async function handleCoachTurn(args: { organizationId: string; learnerId: string; missionId: string; learnerMessage: string }): Promise<CoachResult<CoachTurnOutcome>> {
  if (!args.learnerMessage.trim()) return { ok: false, error: "MESSAGE_REQUIRED" };
  const stageId = await resolveStageIdForMission(args.organizationId, args.missionId);
  if (!stageId) return { ok: false, error: "MISSION_NOT_FOUND" };
  const ctx = await getRuntimeContext(args.organizationId, args.learnerId, stageId, args.missionId);
  if (!ctx) return { ok: false, error: "COACH_NOT_CONFIGURED" };

  const learnerMessageId = crypto.randomUUID();
  await appendConversation(args.organizationId, args.learnerId, args.missionId, { id: learnerMessageId, role: "learner", text: args.learnerMessage.trim(), createdAt: new Date().toISOString() });

  let result: CoachTurnResult | null = null;
  let usedAi = false;
  if (ctx.profile.providerMode !== "offline" && isCoachAiConfigured()) {
    const knowledge = await getKnowledgeContext(args.organizationId, stageId, args.missionId, ctx.profile.knowledgeScope);
    result = await generateCoachTurn({ context: ctx, learnerMessage: args.learnerMessage.trim(), knowledge });
    usedAi = Boolean(result);
  }
  if (!result) result = runOfflineCoachTurn(ctx);

  if (result.candidates.length) {
    await saveProposedMemory(args.organizationId, args.learnerId, args.missionId, result.candidates.map((c) => candidateToMemoryValue(c, learnerMessageId)));
  }

  await appendConversation(args.organizationId, args.learnerId, args.missionId, { id: crypto.randomUUID(), role: "coach", text: result.reply, createdAt: new Date().toISOString() });

  return { ok: true, data: { ...result, missionId: args.missionId, usedAi } };
}

/**
 * Session bootstrap for opening the Coach Workspace: profile/mission config/memory plus message
 * history, seeding a first deterministic greeting+question if this is the learner's first visit to
 * this Mission's Coach (never requires AI — the opening question is always available offline).
 */
export async function getCoachSessionState(organizationId: string, learnerId: string, missionId: string) {
  const stageId = await resolveStageIdForMission(organizationId, missionId);
  if (!stageId) return null;
  const ctx = await getRuntimeContext(organizationId, learnerId, stageId, missionId);
  if (!ctx) return null;

  let messages = await getConversation(organizationId, learnerId, missionId);
  if (!messages.length) {
    const opening = runOfflineCoachTurn(ctx);
    const greeting: CoachConversationMessage = {
      id: crypto.randomUUID(), role: "coach",
      text: `Mình sẽ cùng bạn hoàn thành "${ctx.missionConfig.objective || "mục tiêu này"}". ${opening.reply}`,
      createdAt: new Date().toISOString()
    };
    await appendConversation(organizationId, learnerId, missionId, greeting);
    messages = [greeting];
  }

  return { profile: ctx.profile, missionConfig: ctx.missionConfig, memory: ctx.memory, messages };
}
