import "server-only";
import { resolveMissionContext } from "@/lib/mission-workspace/student";
import { completeSelfReportedMission } from "@/lib/learn-outcome/student";
import { calculateCoachProgress, detectConfirmIntent, determineMissionState, extractCandidatesFromText, runOfflineCoachTurn } from "./offline-engine";
import { generateCoachTurn, isCoachAiConfigured } from "./provider-gateway";
import { appendConversation, getConversation, getKnowledgeContext, getRuntimeContext } from "./repository";
import { saveProposedMemory } from "./memory";
import { missionConfirmedFieldKey, type CoachCandidateExtraction, type CoachConversationMessage, type CoachMissionState } from "./types";

function candidateToMemoryValue(candidate: CoachCandidateExtraction, messageId: string) {
  return {
    field: candidate.field, value: candidate.value,
    status: candidate.requiresConfirmation ? ("proposed" as const) : ("confirmed" as const),
    confidence: candidate.confidence, sourceMessageId: messageId
  };
}

export interface CoachTurnOutcome {
  reply: string; candidates: CoachCandidateExtraction[]; nextQuestion?: string | null;
  completionHints?: string[]; missionState: CoachMissionState; progressPercent: number;
  missionId: string; usedAi: boolean;
}
type CoachResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * One learner message in, one Coach reply out — the required pipeline (docs/h2o-coach-v1, fixed
 * 2026-08-15): resolve -> extract -> validate(trivial: non-empty) -> persist -> await commit ->
 * re-query -> determine next step -> generate reply -> return { message, memory-derived state,
 * progress }. Mission state/progress are ALWAYS derived fresh from learner_memory_values rows here —
 * never from which question was last asked, never decided by the LLM (STEP 3/STEP 8 of the fix spec).
 *
 * Root cause this replaced (found in real production data 2026-08-15): offline mode had zero
 * text-understanding capability by original design (see offline-engine.ts's extractCandidatesFromText
 * doc comment) — no matter what the learner typed, nothing was ever written to memory, so the same
 * question repeated forever and the sidebar stayed empty regardless of the conversation.
 */
export async function handleCoachTurn(args: { organizationId: string; learnerId: string; missionId: string; learnerMessage: string; clientMessageId?: string }): Promise<CoachResult<CoachTurnOutcome>> {
  if (!args.learnerMessage.trim()) return { ok: false, error: "MESSAGE_REQUIRED" };

  // STEP 2: resolve through the SAME access-checked resolver the rest of Mission Workspace uses
  // (lib/mission-workspace/student.ts) — closes a real gap the old resolveStageIdForMission had: it
  // never checked whether the Mission was locked for this student.
  const missionContext = await resolveMissionContext(args.learnerId, args.organizationId, args.missionId);
  if (!missionContext) return { ok: false, error: "MISSION_NOT_FOUND" };
  if (missionContext.mission.displayState === "locked") return { ok: false, error: "MISSION_LOCKED" };
  const stageId = missionContext.stage.id;

  const ctx = await getRuntimeContext(args.organizationId, args.learnerId, stageId, args.missionId);
  if (!ctx) return { ok: false, error: "COACH_NOT_CONFIGURED" };

  // STEP 11: idempotency — a client retry (double click, React StrictMode, network retry) carries the
  // same clientMessageId; recognized here and answered from what was already stored, never processed
  // (and never persisted to memory) a second time.
  const clientMessageId = args.clientMessageId?.trim() || crypto.randomUUID();
  const existingMessages = await getConversation(args.organizationId, args.learnerId, args.missionId);
  const duplicate = existingMessages.find((m) => m.clientMessageId === clientMessageId);
  if (duplicate) {
    const priorReply = existingMessages.slice(existingMessages.indexOf(duplicate) + 1).find((m) => m.role === "coach");
    const missionState = determineMissionState(ctx.missionConfig.requiredFields, ctx.memory, args.missionId);
    const progressPercent = calculateCoachProgress(ctx.missionConfig.requiredFields, ctx.memory, args.missionId);
    return { ok: true, data: { reply: priorReply?.text ?? "", candidates: [], nextQuestion: null, missionState, progressPercent, missionId: args.missionId, usedAi: false } };
  }

  const learnerMessageId = crypto.randomUUID();
  await appendConversation(args.organizationId, args.learnerId, args.missionId, { id: learnerMessageId, role: "learner", text: args.learnerMessage.trim(), createdAt: new Date().toISOString(), clientMessageId });

  const stateBeforeTurn = determineMissionState(ctx.missionConfig.requiredFields, ctx.memory, args.missionId);

  // STEP 5: EXTRACT. Awaiting confirmation is a distinct sub-flow (STEP 7) that only ever interprets
  // yes/no intent, never re-runs field extraction on top of an already-complete profile.
  let candidates: CoachCandidateExtraction[] = [];
  let aiReply: string | null = null;
  let usedAi = false;

  if (stateBeforeTurn === "awaiting_confirmation") {
    if (detectConfirmIntent(args.learnerMessage) === "confirm") {
      candidates = [{ field: missionConfirmedFieldKey(args.missionId), value: true, confidence: 1, requiresConfirmation: false, rationale: "learner confirmed the summary" }];
    }
  } else if (ctx.profile.providerMode !== "offline" && isCoachAiConfigured()) {
    const knowledge = await getKnowledgeContext(args.organizationId, stageId, args.missionId, ctx.profile.knowledgeScope);
    const aiResult = await generateCoachTurn({ context: ctx, learnerMessage: args.learnerMessage.trim(), knowledge });
    if (aiResult) { candidates = aiResult.candidates; aiReply = aiResult.reply; usedAi = true; }
  }
  if (!usedAi && stateBeforeTurn !== "awaiting_confirmation") {
    const confirmedKeys = new Set(ctx.memory.filter((m) => m.status === "confirmed").map((m) => m.field));
    candidates = extractCandidatesFromText(args.learnerMessage, ctx.profile.memorySchema, confirmedKeys);
  }

  // STEP 4/6: PERSIST, then AWAIT COMMIT, then RE-QUERY the authoritative memory before deciding
  // anything else — the pre-turn `ctx.memory` snapshot is never used again past this point.
  if (candidates.length) {
    await saveProposedMemory(args.organizationId, args.learnerId, args.missionId, candidates.map((c) => candidateToMemoryValue(c, learnerMessageId)));
  }
  const freshCtx = await getRuntimeContext(args.organizationId, args.learnerId, stageId, args.missionId);
  if (!freshCtx) return { ok: false, error: "COACH_NOT_CONFIGURED" };

  const deterministic = runOfflineCoachTurn(freshCtx, candidates);
  const reply = aiReply ?? deterministic.reply;

  // Canonical completion trigger, gated only on the deterministic state just computed from real
  // memory — never on conversation text and never decided by AI. Coach confirming the profile
  // summary only auto-completes a self_reported/metric_based Mission (no evidence/review step to
  // begin with); evidence_required/teacher_verified Missions still need their own real evidence —
  // Coach confirmation is not a bypass for that.
  if (deterministic.missionState === "confirmed" && stateBeforeTurn !== "confirmed") {
    const policy = missionContext.mission.completionPolicy;
    if (policy === "self_reported" || policy === "metric_based") {
      await completeSelfReportedMission(args.learnerId, args.organizationId, args.missionId, missionContext.versionId);
    }
  }

  await appendConversation(args.organizationId, args.learnerId, args.missionId, { id: crypto.randomUUID(), role: "coach", text: reply, createdAt: new Date().toISOString() });

  return { ok: true, data: { ...deterministic, reply, missionId: args.missionId, usedAi } };
}

/**
 * Session bootstrap for opening the Coach Workspace: profile/mission config/memory/messages plus the
 * SAME deterministic missionState/progressPercent handleCoachTurn computes — a page refresh (STEP F)
 * must show exactly the state real memory rows imply, never revert to the opening question just
 * because a fresh request came in.
 */
export async function getCoachSessionState(organizationId: string, learnerId: string, missionId: string) {
  const missionContext = await resolveMissionContext(learnerId, organizationId, missionId);
  if (!missionContext) return null;
  const stageId = missionContext.stage.id;

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

  const missionState = determineMissionState(ctx.missionConfig.requiredFields, ctx.memory, missionId);
  const progressPercent = calculateCoachProgress(ctx.missionConfig.requiredFields, ctx.memory, missionId);

  return { profile: ctx.profile, missionConfig: ctx.missionConfig, memory: ctx.memory, messages, missionState, progressPercent };
}
