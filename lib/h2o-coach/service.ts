import "server-only";
import { resolveMissionContext } from "@/lib/mission-workspace/student";
import { completeSelfReportedMission, startMission } from "@/lib/learn-outcome/student";
import { calculateCoachProgress, calculateMissionHealth, detectConfirmIntent, determineMissionState, extractCandidatesFromText, nextBestAction as computeNextBestAction, nextOfflineQuestionRule, questionTargetField, runOfflineCoachTurn } from "./offline-engine";
import { generateCoachTurn, isCoachAiConfigured } from "./provider-gateway";
import { appendConversation, getConversation, getKnowledgeContext, getRuntimeContext } from "./repository";
import { saveProposedMemory } from "./memory";
import { missionConfirmedFieldKey, type CoachCandidateExtraction, type CoachConversationMessage, type CoachMissionHealth, type CoachMissionState, type CoachNextBestAction } from "./types";

function candidateToMemoryValue(candidate: CoachCandidateExtraction, messageId: string) {
  return {
    field: candidate.field, value: candidate.value,
    status: candidate.requiresConfirmation ? ("proposed" as const) : ("confirmed" as const),
    confidence: candidate.confidence, sourceMessageId: messageId
  };
}

/** Only these policies let Coach's own confirmation stand in for Mission completion — see the guard around completeSelfReportedMission below. */
const SELF_COMPLETING_POLICIES = new Set(["self_reported", "metric_based"]);

const EVIDENCE_HANDOFF_REPLY = "Mình đã ghi nhận đủ thông tin bạn chia sẻ. Bước cuối để chính thức hoàn thành Mission này: bạn cần nộp minh chứng thật (ví dụ tải lên file/ảnh) — bấm nút bên dưới để sang đúng bước đó.";

export interface CoachTurnOutcome {
  reply: string; candidates: CoachCandidateExtraction[]; nextQuestion?: string | null;
  completionHints?: string[]; missionState: CoachMissionState; progressPercent: number;
  missionId: string; usedAi: boolean;
  /** True once the learner has confirmed the summary but the Mission's own completion_policy (evidence_required/teacher_verified) still needs a real evidence submission — Coach confirming never bypasses that, so the UI must send the learner to the evidence step instead of claiming the Mission is done. */
  evidencePending: boolean;
  /** v5/41 H2O Coach Workspace Smart V2 — see CoachMissionHealth's doc comment; always populated, computed from real memory rows, never a placeholder. */
  health: CoachMissionHealth;
  nextBestAction: CoachNextBestAction | null;
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
    const evidencePending = missionState === "confirmed" && !SELF_COMPLETING_POLICIES.has(missionContext.mission.completionPolicy);
    return { ok: true, data: { reply: priorReply?.text ?? "", candidates: [], nextQuestion: null, missionState, progressPercent, missionId: args.missionId, usedAi: false, evidencePending, health: calculateMissionHealth(ctx), nextBestAction: computeNextBestAction(ctx, evidencePending) } };
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

    // Fallback found 2026-08-16 in real production data: admin-configured extractionRules cannot
    // cover every real phrasing a student uses ("gái mới lớn"/"18 tuổi nữ"/"nữ 18 đến 30" all mean
    // the same thing to a human but match none of a target_customer field's keyword rules) — without
    // this, the same question repeats forever the moment a student's wording isn't on the admin's
    // list, exactly the original "Coach hỏi lặp lại" bug in a new shape. If keyword matching found
    // nothing but a question is actively pending, the field it targets has no canonical-value list to
    // match against anyway (free-text fields like "who is your target customer" don't have one) — so
    // the student's own words become the value directly, deterministically, no LLM involved. The
    // final whole-mission confirmation step (STEP 7) is still the safety net if this ever captures
    // something wrong.
    if (!candidates.length) {
      const activeRule = nextOfflineQuestionRule(ctx);
      const targetField = activeRule ? questionTargetField(activeRule) : null;
      if (targetField && !confirmedKeys.has(targetField)) {
        candidates = [{ field: targetField, value: args.learnerMessage.trim(), confidence: 0.6, rationale: "câu trả lời trực tiếp cho câu hỏi đang hỏi, không khớp từ khoá đã cấu hình", requiresConfirmation: false }];
      }
    }
  }

  // STEP 4/6: PERSIST, then AWAIT COMMIT, then RE-QUERY the authoritative memory before deciding
  // anything else — the pre-turn `ctx.memory` snapshot is never used again past this point.
  if (candidates.length) {
    await saveProposedMemory(args.organizationId, args.learnerId, args.missionId, candidates.map((c) => candidateToMemoryValue(c, learnerMessageId)));
  }
  const freshCtx = await getRuntimeContext(args.organizationId, args.learnerId, stageId, args.missionId);
  if (!freshCtx) return { ok: false, error: "COACH_NOT_CONFIGURED" };

  const deterministic = runOfflineCoachTurn(freshCtx, candidates);

  // Canonical completion trigger, gated only on the deterministic state just computed from real
  // memory — never on conversation text and never decided by AI. Coach confirming the profile
  // summary only auto-completes a self_reported/metric_based Mission (no evidence/review step to
  // begin with); evidence_required/teacher_verified Missions still need their own real evidence —
  // Coach confirmation is not a bypass for that.
  const policy = missionContext.mission.completionPolicy;
  const evidencePending = deterministic.missionState === "confirmed" && !SELF_COMPLETING_POLICIES.has(policy);
  if (deterministic.missionState === "confirmed" && stateBeforeTurn !== "confirmed" && SELF_COMPLETING_POLICIES.has(policy)) {
    await completeSelfReportedMission(args.learnerId, args.organizationId, args.missionId, missionContext.versionId);
  }

  // Real gap found 2026-08-17: runOfflineCoachTurn()'s "confirmed" reply ("Mission này đã hoàn
  // thành...") is only true for self_reported/metric_based Missions. For evidence_required/
  // teacher_verified ones, "confirmed" means only "learner confirmed the info summary" — the Mission
  // itself is still not complete without a real evidence submission (see the guard above), so saying
  // "đã hoàn thành" here would be a false claim. Every turn while evidencePending is true gets the
  // honest handoff reply instead, pointing at the real evidence step.
  const reply = aiReply ?? (evidencePending ? EVIDENCE_HANDOFF_REPLY : deterministic.reply);

  await appendConversation(args.organizationId, args.learnerId, args.missionId, { id: crypto.randomUUID(), role: "coach", text: reply, createdAt: new Date().toISOString() });

  // v5/41 H2O Coach Workspace Smart V2: Next Best Action needs evidencePending (a service.ts-level
  // concept tied to completion_policy, not something offline-engine.ts's pure functions know about),
  // so it's computed here rather than inside runOfflineCoachTurn — same freshCtx (post-persist,
  // re-queried memory) deterministic already used, so it reflects this turn's real outcome.
  const nextAction = computeNextBestAction(freshCtx, evidencePending);

  // Bug found in production 2026-08-16: runOfflineCoachTurn() always returns candidates: [] (it only
  // uses justExtracted to phrase the "Đã hiểu..." acknowledgment, never echoes it back) — spreading
  // `deterministic` last overwrote the real extraction with that empty array, so the client's Brain
  // Memory sidebar (coach-workspace-shell.tsx's `memory` state) never updated after a turn even though
  // the value was correctly saved and reflected in the chat's own summary text. Field values only
  // reappeared correct after a full page reload re-fetched `initialMemory` from the server. `candidates`
  // here is deliberately re-applied after the spread so this turn's real extraction always reaches the UI.
  return { ok: true, data: { ...deterministic, candidates, reply, missionId: args.missionId, usedAi, evidencePending, nextBestAction: nextAction } };
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

  // Real gap found 2026-08-17: a learner who only ever talked to Coach (never clicked "Bắt đầu" on
  // the old 4-tab screen) had no student_mission_states/student_learning_actions rows — the classic
  // workspace reads `mission.actions.length > 0` as "started" to gate evidence submission
  // (mission-workspace-client.tsx), so the "Đi nộp minh chứng" handoff (service.ts's
  // EVIDENCE_HANDOFF_REPLY) could land the learner on an evidence tab with no working form at all.
  // startMission() is idempotent and now also backfills any action template added after an earlier
  // start (lib/learn-outcome/student.ts, same 2026-08-17 fix) — safe to call on every bootstrap.
  await startMission(learnerId, organizationId, missionId, missionContext.versionId);

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
  const evidencePending = missionState === "confirmed" && !SELF_COMPLETING_POLICIES.has(missionContext.mission.completionPolicy);
  const health = calculateMissionHealth(ctx);
  const nextAction = computeNextBestAction(ctx, evidencePending);

  return { profile: ctx.profile, missionConfig: ctx.missionConfig, memory: ctx.memory, messages, missionState, progressPercent, evidencePending, health, nextBestAction: nextAction };
}
