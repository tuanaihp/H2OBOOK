import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCareerStages } from "@/lib/career-stages/service";
import type { AcademyAdminAccess } from "@/lib/academy-admin/types";
import { emitDomainEvent } from "@/lib/domain/events";
import { stageDisplayRank } from "@/lib/career-stages/types";
import { normalizeKnowledgeScope, type CoachKnowledgeScope, type CoachMemoryFieldSchema, type CoachQuestionRule, type CoachResultTemplate, type CoachStageProfileVersion, type CoachToolBinding, type CoachVersionStatus, type MissionCoachConfig } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type Sb = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

async function emitCoachEvent(organizationId: string, actorId: string, eventName: string, resourceId: string, payload: Record<string, unknown> = {}): Promise<void> {
  try { await emitDomainEvent({ organizationId, actorId, resourceType: "coach_stage_profile_versions", resourceId, eventName, payload }); } catch { /* best-effort, never blocks the caller's write */ }
}

/** Rejects a write against a version that is not draft — same rule requireDraftVersion() enforces for Journey (lib/learn-outcome/admin.ts). */
async function requireDraftProfileVersion(supabase: Sb, organizationId: string, versionId: string): Promise<Result<null>> {
  const { data } = await supabase.from("coach_stage_profile_versions").select("status").eq("organization_id", organizationId).eq("id", versionId).maybeSingle();
  if (!data) return { ok: false, error: "VERSION_NOT_FOUND" };
  if ((data as { status: CoachVersionStatus }).status !== "draft") return { ok: false, error: "VERSION_NOT_DRAFT" };
  return { ok: true, data: null };
}

export interface StageProfileSummary {
  stageId: string; stageTitle: string; stagePosition: number;
  profileId: string | null; publishedVersionId: string | null; publishedVersionNumber: number | null;
  latestDraftVersionId: string | null; status: "published" | "draft" | "unconfigured";
}

/**
 * Builder index — every real, currently-active Stage plus whatever Coach profile status it has.
 * Uses loadCareerStages()'s default (active-only, same as the Roadmap/Journey Builder use everywhere
 * else) rather than a raw career_stages query — an earlier version of this function queried every
 * status and leaked archived/hidden/test stages (e.g. old draft rows never meant to be Coach-
 * configurable) into the Builder's stage grid, found 2026-08-15 in real production data.
 *
 * Bug found in real production data 2026-08-17: `stagePosition` used to be the raw `career_stages
 * .position` column, which is NOT a 1-based display rank — it is a gapless-but-unrenumbered counter
 * that also includes archived/legacy rows (this org has 7 archived test stages occupying positions
 * 0-4), so the Builder showed "GIAI ĐOẠN 05"–"10" for what are actually the 1st through 6th active
 * Stages. Every other screen in the app (Student Library, Smart Journey, Mission Workspace, Data Link
 * Health, Stage 1 resolution) already solves this the same way — `stageDisplayRank()`
 * (lib/career-stages/types.ts) computes the 1-based rank among currently-active stages — this function
 * had simply never been switched over to it. No data was renumbered; this is a pure read-side fix.
 */
export async function listStageProfiles(access: AcademyAdminAccess): Promise<StageProfileSummary[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const [stages, { data: profiles }] = await Promise.all([
    loadCareerStages(access.organizationId),
    supabase.from("coach_stage_profiles").select("id,stage_id,current_published_version_id").eq("organization_id", access.organizationId)
  ]);
  const profileByStage = new Map(((profiles ?? []) as { id: string; stage_id: string; current_published_version_id: string | null }[]).map((p) => [p.stage_id, p]));
  const profileIds = [...profileByStage.values()].map((p) => p.id);
  const { data: versions } = profileIds.length
    ? await supabase.from("coach_stage_profile_versions").select("id,profile_id,version_number,status").eq("organization_id", access.organizationId).in("profile_id", profileIds)
    : { data: [] };
  const versionRows = (versions ?? []) as { id: string; profile_id: string; version_number: number; status: CoachVersionStatus }[];

  return stages.map((stage) => {
    const displayRank = stageDisplayRank(stages, stage.id);
    const profile = profileByStage.get(stage.id);
    if (!profile) return { stageId: stage.id, stageTitle: stage.title, stagePosition: displayRank, profileId: null, publishedVersionId: null, publishedVersionNumber: null, latestDraftVersionId: null, status: "unconfigured" as const };
    const published = profile.current_published_version_id ? versionRows.find((v) => v.id === profile.current_published_version_id) : undefined;
    const latestDraft = versionRows.filter((v) => v.profile_id === profile.id && v.status === "draft").sort((a, b) => b.version_number - a.version_number)[0];
    return {
      stageId: stage.id, stageTitle: stage.title, stagePosition: displayRank, profileId: profile.id,
      publishedVersionId: published?.id ?? null, publishedVersionNumber: published?.version_number ?? null,
      latestDraftVersionId: latestDraft?.id ?? null, status: published ? ("published" as const) : latestDraft ? ("draft" as const) : ("unconfigured" as const)
    };
  });
}

/** One profile per Stage (migration 0057's unique constraint) — creates the profile and its first draft version if this Stage has never been configured. */
export async function getOrCreateProfile(access: AcademyAdminAccess, stageId: string): Promise<Result<{ profileId: string; versionId: string; created: boolean }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const org = access.organizationId;

  const existing = await supabase.from("coach_stage_profiles").select("id").eq("organization_id", org).eq("stage_id", stageId).maybeSingle();
  let profileId = (existing.data as { id: string } | null)?.id ?? null;
  if (profileId) {
    const latest = await supabase.from("coach_stage_profile_versions").select("id").eq("organization_id", org).eq("profile_id", profileId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    if (latest.data) return { ok: true, data: { profileId, versionId: (latest.data as { id: string }).id, created: false } };
  }
  if (!profileId) {
    const { data: created, error } = await supabase.from("coach_stage_profiles").insert({ organization_id: org, stage_id: stageId }).select("id").single();
    if (error || !created) return { ok: false, error: error?.message ?? "PROFILE_CREATE_FAILED" };
    profileId = created.id;
  }
  if (!profileId) return { ok: false, error: "PROFILE_CREATE_FAILED" };
  const { data: version, error: versionError } = await supabase.from("coach_stage_profile_versions").insert({
    organization_id: org, profile_id: profileId, version_number: 1, status: "draft", coach_role: "H2O Coach", created_by: access.userId,
    knowledge_scope: normalizeKnowledgeScope(null), memory_schema: []
  }).select("id").single();
  if (versionError || !version) return { ok: false, error: versionError?.message ?? "VERSION_CREATE_FAILED" };
  return { ok: true, data: { profileId, versionId: version.id, created: true } };
}

/** "Nhân bản phiên bản" — copies scalar config plus every coach_mission_configs row from sourceVersionId into a brand new draft on the same profile. */
export async function duplicateProfileVersion(access: AcademyAdminAccess, profileId: string, sourceVersionId: string): Promise<Result<{ versionId: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const org = access.organizationId;

  const { data: source } = await supabase.from("coach_stage_profile_versions").select("name,coach_role,system_tone,provider_mode,knowledge_scope,memory_schema").eq("organization_id", org).eq("id", sourceVersionId).maybeSingle();
  if (!source) return { ok: false, error: "SOURCE_VERSION_NOT_FOUND" };

  const latest = await supabase.from("coach_stage_profile_versions").select("version_number").eq("organization_id", org).eq("profile_id", profileId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextNumber = latest.data ? Number((latest.data as { version_number: number }).version_number) + 1 : 1;

  const { data: version, error } = await supabase.from("coach_stage_profile_versions").insert({
    organization_id: org, profile_id: profileId, version_number: nextNumber, status: "draft", created_by: access.userId,
    name: source.name, coach_role: source.coach_role, system_tone: source.system_tone, provider_mode: source.provider_mode,
    knowledge_scope: normalizeKnowledgeScope(source.knowledge_scope), memory_schema: source.memory_schema ?? []
  }).select("id").single();
  if (error || !version) return { ok: false, error: error?.message ?? "VERSION_CREATE_FAILED" };

  const { data: missionConfigs } = await supabase.from("coach_mission_configs").select("mission_id,objective,coach_instructions,required_fields,questions,tools,result_template,rubric,evidence_requirements").eq("organization_id", org).eq("profile_version_id", sourceVersionId);
  for (const row of (missionConfigs ?? []) as { mission_id: string; objective: string; coach_instructions: string | null; required_fields: string[]; questions: unknown; tools: unknown; result_template: unknown; rubric: unknown; evidence_requirements: unknown }[]) {
    await supabase.from("coach_mission_configs").insert({
      organization_id: org, profile_version_id: version.id, mission_id: row.mission_id, objective: row.objective,
      coach_instructions: row.coach_instructions, required_fields: row.required_fields, questions: row.questions,
      tools: row.tools, result_template: row.result_template, rubric: row.rubric, evidence_requirements: row.evidence_requirements
    });
  }

  await emitCoachEvent(org, access.userId, "coach.profile_version_cloned", version.id, { sourceVersionId, profileId });
  return { ok: true, data: { versionId: version.id } };
}

export interface ProfileVersionPatch {
  name?: string; coachRole?: string; systemTone?: string; providerMode?: "offline" | "hybrid" | "ai";
  knowledgeScope?: CoachKnowledgeScope; memorySchema?: CoachMemoryFieldSchema[];
}

export async function updateProfileVersion(access: AcademyAdminAccess, versionId: string, patch: ProfileVersionPatch): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftProfileVersion(supabase, access.organizationId, versionId);
  if (!draftCheck.ok) return draftCheck;

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.coachRole !== undefined) dbPatch.coach_role = patch.coachRole;
  if (patch.systemTone !== undefined) dbPatch.system_tone = patch.systemTone;
  if (patch.providerMode !== undefined) dbPatch.provider_mode = patch.providerMode;
  if (patch.knowledgeScope !== undefined) dbPatch.knowledge_scope = patch.knowledgeScope;
  if (patch.memorySchema !== undefined) dbPatch.memory_schema = patch.memorySchema;

  const { error } = await supabase.from("coach_stage_profile_versions").update(dbPatch).eq("organization_id", access.organizationId).eq("id", versionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export interface MissionConfigInput {
  objective: string; coachInstructions?: string; requiredFields: string[]; questions: CoachQuestionRule[]; tools: CoachToolBinding[];
  resultTemplate?: CoachResultTemplate; rubric?: Record<string, unknown>; evidenceRequirements?: Record<string, unknown>[];
}

/** Create/replace one Mission's coaching config within a draft profile version — requires the version to still be draft, same as every other Coach Builder write. */
export async function upsertMissionConfig(access: AcademyAdminAccess, profileVersionId: string, missionId: string, input: MissionConfigInput): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftProfileVersion(supabase, access.organizationId, profileVersionId);
  if (!draftCheck.ok) return draftCheck;

  const mission = await supabase.from("learning_journey_missions").select("id").eq("organization_id", access.organizationId).eq("id", missionId).maybeSingle();
  if (!mission.data) return { ok: false, error: "MISSION_NOT_FOUND" };

  const { data, error } = await supabase.from("coach_mission_configs").upsert({
    organization_id: access.organizationId, profile_version_id: profileVersionId, mission_id: missionId,
    objective: input.objective, coach_instructions: input.coachInstructions ?? "", required_fields: input.requiredFields, questions: input.questions, tools: input.tools,
    result_template: input.resultTemplate ?? null, rubric: input.rubric ?? {}, evidence_requirements: input.evidenceRequirements ?? [], updated_at: new Date().toISOString()
  }, { onConflict: "profile_version_id,mission_id" }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "MISSION_CONFIG_SAVE_FAILED" };
  return { ok: true, data: { id: data.id } };
}

/**
 * Publish OR rollback — the same operation either way (source prompt's own flow: "Áp dụng -> có thể
 * rollback" republishes a previously archived version through this exact function, it does not need
 * a second code path). Works on a draft OR an already-archived version; archives whichever version is
 * currently published, points the profile's current_published_version_id at this one, always stamps
 * a fresh published_at (matches learning_journey_versions.publishVersion()'s exact behavior — each
 * publish event gets its own timestamp, not preserved from the first time a version went live).
 */
export async function publishProfileVersion(access: AcademyAdminAccess, profileId: string, versionId: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const org = access.organizationId;

  const target = await supabase.from("coach_stage_profile_versions").select("id,status").eq("organization_id", org).eq("id", versionId).eq("profile_id", profileId).maybeSingle();
  if (!target.data) return { ok: false, error: "VERSION_NOT_FOUND" };

  const { data: outgoing } = await supabase.from("coach_stage_profile_versions").select("id").eq("organization_id", org).eq("profile_id", profileId).eq("status", "published").maybeSingle();
  const outgoingVersionId = (outgoing as { id: string } | null)?.id ?? null;

  if (outgoingVersionId && outgoingVersionId !== versionId) {
    const { error: archiveError } = await supabase.from("coach_stage_profile_versions").update({ status: "archived" }).eq("organization_id", org).eq("id", outgoingVersionId);
    if (archiveError) return { ok: false, error: archiveError.message };
  }

  const publishedAt = new Date().toISOString();
  const { error: publishError } = await supabase.from("coach_stage_profile_versions").update({ status: "published", published_at: publishedAt }).eq("organization_id", org).eq("id", versionId);
  if (publishError) return { ok: false, error: publishError.message };

  const { error: pointerError } = await supabase.from("coach_stage_profiles").update({ current_published_version_id: versionId, updated_at: publishedAt }).eq("organization_id", org).eq("id", profileId);
  if (pointerError) return { ok: false, error: pointerError.message };

  await emitCoachEvent(org, access.userId, "coach.profile_version_published", versionId, { profileId, outgoingVersionId, wasRollback: (target.data as { status: CoachVersionStatus }).status === "archived" });
  return { ok: true, data: null };
}

export interface ProfileVersionDetail extends CoachStageProfileVersion { missionConfigs: MissionCoachConfig[] }

/** Full detail for the 8-section editor: scalar profile fields plus every Mission's coaching config on this version. */
export async function getProfileVersionDetail(access: AcademyAdminAccess, versionId: string): Promise<ProfileVersionDetail | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: version } = await supabase.from("coach_stage_profile_versions").select("*").eq("organization_id", access.organizationId).eq("id", versionId).maybeSingle();
  if (!version) return null;
  const v = version as { id: string; organization_id: string; profile_id: string; version_number: number; status: CoachVersionStatus; name: string; coach_role: string; system_tone: string; provider_mode: "offline" | "hybrid" | "ai"; knowledge_scope: CoachKnowledgeScope; memory_schema: CoachMemoryFieldSchema[]; published_at: string | null; created_at: string; updated_at: string };

  const { data: configs } = await supabase.from("coach_mission_configs").select("id,profile_version_id,mission_id,objective,coach_instructions,required_fields,questions,tools,result_template,rubric,evidence_requirements").eq("organization_id", access.organizationId).eq("profile_version_id", versionId);
  const missionConfigs: MissionCoachConfig[] = ((configs ?? []) as { id: string; profile_version_id: string; mission_id: string; objective: string; coach_instructions: string | null; required_fields: string[]; questions: CoachQuestionRule[]; tools: CoachToolBinding[]; result_template: CoachResultTemplate | null; rubric: Record<string, unknown> | null; evidence_requirements: Record<string, unknown>[] | null }[])
    .map((row) => ({
      id: row.id, profileVersionId: row.profile_version_id, missionId: row.mission_id, objective: row.objective,
      coachInstructions: row.coach_instructions ?? "", requiredFields: row.required_fields ?? [], questions: row.questions ?? [],
      tools: row.tools ?? [], resultTemplate: row.result_template ?? undefined, rubric: row.rubric ?? {}, evidenceRequirements: row.evidence_requirements ?? []
    }));

  return {
    id: v.id, organizationId: v.organization_id, profileId: v.profile_id, versionNumber: v.version_number, status: v.status,
    name: v.name, coachRole: v.coach_role, systemTone: v.system_tone, providerMode: v.provider_mode,
    knowledgeScope: normalizeKnowledgeScope(v.knowledge_scope),
    memorySchema: v.memory_schema ?? [], publishedAt: v.published_at, createdAt: v.created_at, updatedAt: v.updated_at, missionConfigs
  };
}

/** Real Missions on a Stage's PUBLISHED journey — the Mission Coaching tab's picker. A Stage with no published journey yet (draft-only) has no missions a Coach could reference, so this returns empty rather than surfacing draft-only content. */
export async function listMissionsForStage(access: AcademyAdminAccess, stageId: string): Promise<{ id: string; title: string }[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const org = access.organizationId;
  const blueprint = await supabase.from("learning_journey_blueprints").select("current_published_version_id").eq("organization_id", org).eq("stage_id", stageId).maybeSingle();
  const versionId = (blueprint.data as { current_published_version_id: string | null } | null)?.current_published_version_id;
  if (!versionId) return [];
  const outcomes = await supabase.from("learning_journey_outcomes").select("id").eq("organization_id", org).eq("version_id", versionId);
  const outcomeIds = ((outcomes.data ?? []) as { id: string }[]).map((o) => o.id);
  if (!outcomeIds.length) return [];
  const milestones = await supabase.from("learning_journey_milestones").select("id").eq("organization_id", org).in("outcome_id", outcomeIds);
  const milestoneIds = ((milestones.data ?? []) as { id: string }[]).map((m) => m.id);
  if (!milestoneIds.length) return [];
  const missions = await supabase.from("learning_journey_missions").select("id,title,position").eq("organization_id", org).in("milestone_id", milestoneIds).order("position", { ascending: true });
  return ((missions.data ?? []) as { id: string; title: string; position: number }[]).map((m) => ({ id: m.id, title: m.title }));
}

function slugify(text: string): string {
  const base = text.replace(/đ/g, "d").replace(/Đ/g, "D")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return base.slice(0, 24) || "mission";
}

interface MissionForAutoGen { id: string; title: string; expectedResult: string; successCriteria: string[]; completionPolicy: string; evidencePolicy: Record<string, unknown> }

async function loadMissionForAutoGen(supabase: Sb, organizationId: string, missionId: string): Promise<MissionForAutoGen | null> {
  const { data } = await supabase.from("learning_journey_missions").select("id,title,expected_result,success_criteria,completion_policy,evidence_policy").eq("organization_id", organizationId).eq("id", missionId).maybeSingle();
  if (!data) return null;
  const row = data as { id: string; title: string; expected_result: string | null; success_criteria: string[] | null; completion_policy: string; evidence_policy: Record<string, unknown> | null };
  return { id: row.id, title: row.title, expectedResult: row.expected_result ?? "", successCriteria: row.success_criteria ?? [], completionPolicy: row.completion_policy, evidencePolicy: row.evidence_policy ?? {} };
}

const SELF_COMPLETING_POLICIES = new Set(["self_reported", "metric_based"]);

/**
 * "Tự động tạo cấu hình Coach" — deterministically derives a first-draft Mission Coach config from
 * data the admin already entered elsewhere (success_criteria/expected_result/completion_policy on
 * learning_journey_missions), instead of either (a) an admin hand-authoring every Mission's questions
 * from scratch — does not scale to a 6-Stage, 100+-Mission curriculum — or (b) requiring AI. One
 * memory field + one question per success criterion — the exact same "the student's own words become
 * the value, no keyword list needed" pattern the direct-answer fallback (offline-engine.ts) already
 * handles for free-text fields. Never auto-publishes (same "AI/automation never bypasses admin review"
 * rule as the Knowledge Gateway's AI-assist) — writes into the draft version only, through the SAME
 * upsertMissionConfig/updateProfileVersion paths the Coach Builder UI itself uses when an admin types,
 * so the admin reviews/edits/tests (Chat thử) before Publish, same as any hand-authored Mission.
 *
 * Idempotent: re-running for a Mission that was already auto-generated fully replaces its config
 * (upsertMissionConfig is itself an upsert) rather than accumulating duplicate fields/questions —
 * matching the codebase's existing "full replace on save" convention (MissionConfigEditor's onSave
 * behaves the same way for hand edits).
 */
export async function autoGenerateMissionConfig(access: AcademyAdminAccess, profileVersionId: string, missionId: string): Promise<Result<{ id: string; fieldsAdded: number; source: "success_criteria" | "expected_result" | "title" }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftProfileVersion(supabase, access.organizationId, profileVersionId);
  if (!draftCheck.ok) return draftCheck;

  const mission = await loadMissionForAutoGen(supabase, access.organizationId, missionId);
  if (!mission) return { ok: false, error: "MISSION_NOT_FOUND" };

  // Real gap found 2026-08-17 auditing this feature against real data: only 28 of this org's 58
  // Missions have success_criteria populated — a hard requirement on it would leave the auto-generate
  // button unusable for the other 30, including the exact Mission ("Makeup Style DNA") the admin was
  // looking at when they asked for this. Falls back through what real data IS available rather than
  // erroring: success_criteria (one field per criterion, richest) -> expected_result (one field,
  // still grounded in real curriculum data the admin already wrote) -> title (last resort, every
  // Mission has one). Never fabricates content that isn't already in the database somewhere.
  const criteria = mission.successCriteria.length ? mission.successCriteria : mission.expectedResult ? [mission.expectedResult] : [mission.title];
  const source: "success_criteria" | "expected_result" | "title" = mission.successCriteria.length ? "success_criteria" : mission.expectedResult ? "expected_result" : "title";

  const { data: versionRow } = await supabase.from("coach_stage_profile_versions").select("memory_schema").eq("organization_id", access.organizationId).eq("id", profileVersionId).maybeSingle();
  const existingSchema = ((versionRow as { memory_schema: CoachMemoryFieldSchema[] } | null)?.memory_schema ?? []);
  const existingKeys = new Set(existingSchema.map((f) => f.key));

  // Namespaced with a slice of the Mission's own id so two Missions never collide on a shared-schema
  // field key even if their titles are similar/duplicated across Stages.
  const namespace = `${slugify(mission.title)}_${mission.id.slice(0, 6)}`;
  const newFields: CoachMemoryFieldSchema[] = [];
  const requiredFields: string[] = [];
  const questions: CoachQuestionRule[] = [];
  criteria.forEach((criterion, idx) => {
    const key = `${namespace}.criterion_${idx + 1}`;
    requiredFields.push(key);
    if (!existingKeys.has(key)) newFields.push({ key, label: criterion.length > 60 ? `${criterion.slice(0, 57)}...` : criterion, namespace, type: "text", requiresConfirmation: true });
    questions.push({ id: crypto.randomUUID(), when: [{ field: key, op: "missing" as const }], prompt: `Chia sẻ với mình: ${criterion}`, priority: criteria.length - idx });
  });

  if (newFields.length) {
    const patch = await updateProfileVersion(access, profileVersionId, { memorySchema: [...existingSchema, ...newFields] });
    if (!patch.ok) return patch;
  }

  const needsEvidence = !SELF_COMPLETING_POLICIES.has(mission.completionPolicy);
  const sourceLabel = source === "success_criteria" ? "success_criteria" : source === "expected_result" ? "expected_result (Mission chưa có Success Criteria — nên bổ sung để câu hỏi chi tiết hơn)" : "tên Mission (Mission chưa có Success Criteria lẫn Expected Result — nên bổ sung)";
  const result = await upsertMissionConfig(access, profileVersionId, missionId, {
    objective: mission.expectedResult || mission.title,
    coachInstructions: `Tự động tạo từ ${sourceLabel} — xem lại câu hỏi/độ ưu tiên trước khi Áp dụng cho học viên.`,
    requiredFields, questions, tools: [],
    rubric: { successCriteria: mission.successCriteria },
    evidenceRequirements: needsEvidence ? [{ ...mission.evidencePolicy, description: "Xem yêu cầu minh chứng đầy đủ ở tab Minh chứng của Mission." }] : []
  });
  if (!result.ok) return result;
  return { ok: true, data: { id: result.data.id, fieldsAdded: newFields.length, source } };
}

/**
 * Bulk version — every real Mission on this Stage's published Journey that doesn't already have a
 * config on THIS draft version. Skips (never overwrites) anything already configured, whether that
 * was hand-authored or auto-generated on an earlier run, so re-running after manually tweaking a few
 * Missions is safe.
 */
export async function autoGenerateAllMissionConfigs(access: AcademyAdminAccess, profileVersionId: string, stageId: string): Promise<Result<{ generated: number; skipped: number; errors: string[] }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const draftCheck = await requireDraftProfileVersion(supabase, access.organizationId, profileVersionId);
  if (!draftCheck.ok) return draftCheck;

  const missions = await listMissionsForStage(access, stageId);
  const { data: existingConfigs } = await supabase.from("coach_mission_configs").select("mission_id").eq("organization_id", access.organizationId).eq("profile_version_id", profileVersionId);
  const configuredIds = new Set(((existingConfigs ?? []) as { mission_id: string }[]).map((c) => c.mission_id));

  let generated = 0; let skipped = 0; const errors: string[] = [];
  for (const mission of missions) {
    if (configuredIds.has(mission.id)) { skipped++; continue; }
    const result = await autoGenerateMissionConfig(access, profileVersionId, mission.id);
    if (result.ok) generated++;
    else errors.push(`${mission.title}: ${result.error}`);
  }
  return { ok: true, data: { generated, skipped, errors } };
}

/** Every version of a Stage's Coach profile, newest first — the "Lịch sử" / version list. */
export async function listProfileVersions(access: AcademyAdminAccess, profileId: string): Promise<{ id: string; versionNumber: number; status: CoachVersionStatus; publishedAt: string | null }[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("coach_stage_profile_versions").select("id,version_number,status,published_at").eq("organization_id", access.organizationId).eq("profile_id", profileId).order("version_number", { ascending: false });
  return ((data ?? []) as { id: string; version_number: number; status: CoachVersionStatus; published_at: string | null }[]).map((row) => ({ id: row.id, versionNumber: row.version_number, status: row.status, publishedAt: row.published_at }));
}
