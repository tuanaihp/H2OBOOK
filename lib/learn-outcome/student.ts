import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublishedJourneyForStage } from "./service";
import type { JourneyMission, JourneyOutcome, MissionResourceBinding, StudentMissionState } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type MissionDisplayState = "locked" | "available" | StudentMissionState;

export interface ResolvedResourceBinding extends MissionResourceBinding { title: string }
export interface MissionWithProgress extends Omit<JourneyMission, "resourceBindings"> {
  displayState: MissionDisplayState;
  resourceBindings: ResolvedResourceBinding[];
  actions: { id: string; title: string; required: boolean; evidenceRequired: boolean; status: string }[];
}
export interface OutcomeWithProgress extends Omit<JourneyOutcome, "milestones"> {
  milestones: { id: string; title: string; description: string; missions: MissionWithProgress[] }[];
}

type StateRow = { mission_id: string; state: string; progress_percent: number; started_at: string | null; verified_at: string | null; result_achieved_at: string | null; evidence: unknown[]; evidence_submitted_at: string | null };
type ActionRow = { id: string; mission_id: string; title: string; status: string; source_id: string | null };

/**
 * The Journey Map for a student's current stage, with every mission's real per-student state
 * folded in. locked/available are derived, not stored: a mission is available once its
 * prerequisite (if any) has reached result_achieved, and locked otherwise — the same "first free,
 * rest behind a real condition" shape lib/student/stage-access.ts already uses for stages.
 */
export async function getJourneyForStudent(userId: string, organizationId: string, stageId: string): Promise<{ outcomes: OutcomeWithProgress[]; versionId: string | null; blueprintTitle: string | null; progressPercent: number } | null> {
  const published = await getPublishedJourneyForStage(organizationId, stageId);
  if (!published) return null;

  const admin = createSupabaseAdminClient();
  const missions = published.outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions));
  const missionIds = missions.map((m) => m.id);
  if (!admin || !missionIds.length) {
    return {
      outcomes: published.outcomes.map((o) => ({ ...o, milestones: o.milestones.map((m) => ({ ...m, missions: m.missions.map((mission) => ({ ...mission, displayState: "locked" as const, resourceBindings: [], actions: [] })) })) })) as unknown as OutcomeWithProgress[],
      versionId: published.version.id, blueprintTitle: published.blueprint.title, progressPercent: 0
    };
  }

  const [{ data: stateRows }, { data: actionRows }] = await Promise.all([
    admin.from("student_mission_states").select("mission_id,state,progress_percent,started_at,verified_at,result_achieved_at,evidence,evidence_submitted_at").eq("organization_id", organizationId).eq("student_id", userId).eq("blueprint_version_id", published.version.id).in("mission_id", missionIds),
    admin.from("student_learning_actions").select("id,mission_id,title,status,source_id").eq("organization_id", organizationId).eq("student_id", userId).in("mission_id", missionIds)
  ]);
  const stateByMission = new Map(((stateRows ?? []) as StateRow[]).map((r) => [r.mission_id, r]));
  const actionsByMission = new Map<string, ActionRow[]>();
  for (const row of (actionRows ?? []) as ActionRow[]) {
    const list = actionsByMission.get(row.mission_id) ?? [];
    list.push(row);
    actionsByMission.set(row.mission_id, list);
  }

  // "Không hiển thị UUID nếu source title resolve được" — every binding names a table via
  // resource_type (same convention as the preflight existence check), resolved here in two batched
  // queries rather than one per binding.
  const allBindings = missions.flatMap((m) => m.resourceBindings);
  const documentIds = [...new Set(allBindings.filter((b) => b.resourceType === "document").map((b) => b.resourceId))];
  const placementIds = [...new Set(allBindings.filter((b) => b.resourceType === "career_stage_resource").map((b) => b.resourceId))];
  const [{ data: documentRows }, { data: placementRows }] = await Promise.all([
    documentIds.length ? admin.from("curriculum_documents").select("id,title").eq("organization_id", organizationId).in("id", documentIds) : Promise.resolve({ data: [] }),
    placementIds.length ? admin.from("career_stage_resources").select("id,title_override").eq("organization_id", organizationId).in("id", placementIds) : Promise.resolve({ data: [] })
  ]);
  const titleById = new Map<string, string>();
  for (const row of (documentRows ?? []) as { id: string; title: string }[]) titleById.set(row.id, row.title);
  for (const row of (placementRows ?? []) as { id: string; title_override: string | null }[]) if (row.title_override) titleById.set(row.id, row.title_override);

  const achievedMissionIds = new Set(missions.filter((m) => stateByMission.get(m.id)?.state === "result_achieved").map((m) => m.id));

  function displayStateFor(mission: JourneyMission): MissionDisplayState {
    if (mission.prerequisiteMissionId && !achievedMissionIds.has(mission.prerequisiteMissionId)) return "locked";
    const state = stateByMission.get(mission.id)?.state;
    return (state as StudentMissionState) ?? "available";
  }

  const outcomes: OutcomeWithProgress[] = published.outcomes.map((outcome) => ({
    ...outcome,
    milestones: outcome.milestones.map((milestone) => ({
      id: milestone.id, title: milestone.title, description: milestone.description,
      missions: milestone.missions.map((mission): MissionWithProgress => ({
        ...mission,
        displayState: displayStateFor(mission),
        resourceBindings: mission.resourceBindings.map((binding) => ({ ...binding, title: titleById.get(binding.resourceId) ?? "Tài liệu (đang chờ nội dung)" })),
        actions: (actionsByMission.get(mission.id) ?? []).map((a) => {
          const template = mission.actionTemplates.find((t) => t.id === a.source_id);
          return { id: a.id, title: a.title, required: template?.required ?? true, evidenceRequired: template?.evidenceRequired ?? false, status: a.status };
        })
      }))
    }))
  }));

  const progressPercent = missions.length ? Math.round((achievedMissionIds.size / missions.length) * 100) : 0;
  return { outcomes, versionId: published.version.id, blueprintTitle: published.blueprint.title, progressPercent };
}

/**
 * Idempotent by design (Release B test #7 "retry không duplicate action"): the unique constraint on
 * student_mission_states(student_id, mission_id, blueprint_version_id) is the real guard — a second
 * call finds the existing row and returns it rather than inserting again, and only creates action
 * rows the first time a mission state is created for this student, never on a repeat call.
 */
export async function startMission(userId: string, organizationId: string, missionId: string, blueprintVersionId: string): Promise<Result<{ created: boolean }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const existing = await supabase.from("student_mission_states").select("id").eq("organization_id", organizationId).eq("student_id", userId).eq("mission_id", missionId).eq("blueprint_version_id", blueprintVersionId).maybeSingle();
  if (existing.data) return { ok: true, data: { created: false } };

  const { error: insertError } = await supabase.from("student_mission_states").insert({
    organization_id: organizationId, student_id: userId, mission_id: missionId, blueprint_version_id: blueprintVersionId,
    state: "doing", progress_percent: 0, started_at: new Date().toISOString()
  });
  // 23505 = unique_violation: a concurrent request already created the row (e.g. a double-click
  // firing two requests before the first one's insert lands) — not an error, the same "already
  // started" outcome as finding it in the initial select.
  if (insertError && insertError.code !== "23505") return { ok: false, error: insertError.message };

  const { data: templates } = await supabase.from("learning_mission_action_templates").select("id,title,required,evidence_required").eq("organization_id", organizationId).eq("mission_id", missionId).order("position", { ascending: true });
  if (templates?.length) {
    const rows = templates.map((t: { id: string; title: string }) => ({
      organization_id: organizationId, student_id: userId, mission_id: missionId,
      source_type: "mission_template", source_id: t.id, title: t.title, status: "planned"
    }));
    await supabase.from("student_learning_actions").insert(rows).select("id");
  }
  return { ok: true, data: { created: true } };
}

export async function updateActionStatus(userId: string, actionId: string, status: "planned" | "doing" | "completed" | "skipped"): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("student_learning_actions").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("student_id", userId).eq("id", actionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/**
 * Records evidence directly on the mission-state row (migration 0051 — see its comment for why this
 * is not a second assignment/submission engine) and advances the state machine: evidence_required
 * missions are self-serve (verified the moment evidence lands), teacher_verified missions wait for
 * an explicit teacher action instead.
 *
 * completion_policy is looked up here, not taken from the caller — a client that could name its own
 * policy could claim "evidence_required" on a teacher_verified mission and self-verify Before/After
 * submissions without review.
 */
export async function submitEvidence(userId: string, organizationId: string, missionId: string, blueprintVersionId: string, evidence: { note?: string; assetId?: string }): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const mission = await supabase.from("learning_journey_missions").select("completion_policy").eq("organization_id", organizationId).eq("id", missionId).maybeSingle();
  if (!mission.data) return { ok: false, error: "MISSION_NOT_FOUND" };
  const completionPolicy = String((mission.data as { completion_policy: string }).completion_policy);
  const now = new Date().toISOString();
  const nextState = completionPolicy === "teacher_verified" ? "review_pending" : "verified";
  const { data: current } = await supabase.from("student_mission_states").select("evidence").eq("organization_id", organizationId).eq("student_id", userId).eq("mission_id", missionId).eq("blueprint_version_id", blueprintVersionId).maybeSingle();
  const priorEvidence = Array.isArray(current?.evidence) ? current.evidence : [];
  const patch: Record<string, unknown> = {
    evidence: [...priorEvidence, { ...evidence, submittedAt: now }],
    evidence_submitted_at: now, state: nextState
  };
  if (nextState === "verified") patch.verified_at = now;
  const { error } = await supabase.from("student_mission_states").update(patch).eq("organization_id", organizationId).eq("student_id", userId).eq("mission_id", missionId).eq("blueprint_version_id", blueprintVersionId);
  if (error) return { ok: false, error: error.message };
  if (nextState === "verified") await maybeMarkResultAchieved(supabase, organizationId, userId, missionId, blueprintVersionId);
  return { ok: true, data: null };
}

/** Owner/admin/teacher review — the only state transition a student cannot make on their own row. */
export async function teacherVerifyMission(access: { organizationId: string; userId: string }, studentId: string, missionId: string, blueprintVersionId: string, approve: boolean): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = approve
    ? { state: "verified", verified_at: now, verified_by: access.userId }
    : { state: "blocked" };
  const { error } = await supabase.from("student_mission_states").update(patch).eq("organization_id", access.organizationId).eq("student_id", studentId).eq("mission_id", missionId).eq("blueprint_version_id", blueprintVersionId);
  if (error) return { ok: false, error: error.message };
  if (approve) await maybeMarkResultAchieved(supabase, access.organizationId, studentId, missionId, blueprintVersionId);
  return { ok: true, data: null };
}

/**
 * self_reported / metric_based missions have no evidence/review step — completing every required
 * action is the completion signal. Refuses on any other policy so this cannot be used as a bypass
 * for missions that actually require evidence or teacher review — the same policy lookup
 * submitEvidence does, for the same reason.
 */
export async function completeSelfReportedMission(userId: string, organizationId: string, missionId: string, blueprintVersionId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const mission = await supabase.from("learning_journey_missions").select("completion_policy").eq("organization_id", organizationId).eq("id", missionId).maybeSingle();
  if (!mission.data) return { ok: false, error: "MISSION_NOT_FOUND" };
  const completionPolicy = String((mission.data as { completion_policy: string }).completion_policy);
  if (completionPolicy !== "self_reported" && completionPolicy !== "metric_based") return { ok: false, error: "MISSION_REQUIRES_EVIDENCE" };
  const now = new Date().toISOString();
  const { error } = await supabase.from("student_mission_states").update({ state: "result_achieved", result_achieved_at: now }).eq("organization_id", organizationId).eq("student_id", userId).eq("mission_id", missionId).eq("blueprint_version_id", blueprintVersionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

async function maybeMarkResultAchieved(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, organizationId: string, studentId: string, missionId: string, blueprintVersionId: string) {
  const now = new Date().toISOString();
  await supabase.from("student_mission_states").update({ state: "result_achieved", result_achieved_at: now }).eq("organization_id", organizationId).eq("student_id", studentId).eq("mission_id", missionId).eq("blueprint_version_id", blueprintVersionId);
}
