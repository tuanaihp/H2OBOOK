import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLearnerMemory } from "./memory";
import { normalizeKnowledgeScope, type CoachConversationMessage, type CoachKnowledgeScope, type CoachRuntimeContext, type CoachStageProfileVersion, type MissionCoachConfig } from "./types";

interface ProfileVersionRow {
  id: string; organization_id: string; profile_id: string; version_number: number; status: "draft" | "published" | "archived";
  name: string; coach_role: string; system_tone: string; provider_mode: "offline" | "hybrid" | "ai";
  knowledge_scope: CoachKnowledgeScope; memory_schema: CoachStageProfileVersion["memorySchema"];
  published_at: string | null; created_at: string; updated_at: string;
}
function mapVersion(row: ProfileVersionRow): CoachStageProfileVersion {
  return {
    id: row.id, organizationId: row.organization_id, profileId: row.profile_id, versionNumber: row.version_number,
    status: row.status, name: row.name, coachRole: row.coach_role, systemTone: row.system_tone, providerMode: row.provider_mode,
    knowledgeScope: normalizeKnowledgeScope(row.knowledge_scope),
    memorySchema: row.memory_schema ?? [], publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

/** Only ever resolves via current_published_version_id — a draft is never surfaced to a student by construction, same convention learning_journey_blueprints' student-facing reads already rely on. */
export async function getPublishedStageProfile(organizationId: string, stageId: string): Promise<CoachStageProfileVersion | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data: profile } = await admin.from("coach_stage_profiles").select("current_published_version_id").eq("organization_id", organizationId).eq("stage_id", stageId).maybeSingle();
  const versionId = (profile as { current_published_version_id: string | null } | null)?.current_published_version_id;
  if (!versionId) return null;
  const { data: version } = await admin.from("coach_stage_profile_versions").select("*").eq("id", versionId).maybeSingle();
  return version ? mapVersion(version as ProfileVersionRow) : null;
}

interface MissionConfigRow {
  id: string; profile_version_id: string; mission_id: string; objective: string; required_fields: string[];
  questions: MissionCoachConfig["questions"]; tools: MissionCoachConfig["tools"]; result_template: MissionCoachConfig["resultTemplate"] | null;
}
function mapMissionConfig(row: MissionConfigRow): MissionCoachConfig {
  return { id: row.id, profileVersionId: row.profile_version_id, missionId: row.mission_id, objective: row.objective, requiredFields: row.required_fields ?? [], questions: row.questions ?? [], tools: row.tools ?? [], resultTemplate: row.result_template ?? undefined };
}

export async function getMissionConfig(organizationId: string, profileVersionId: string, missionId: string): Promise<MissionCoachConfig | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("coach_mission_configs").select("*").eq("organization_id", organizationId).eq("profile_version_id", profileVersionId).eq("mission_id", missionId).maybeSingle();
  return data ? mapMissionConfig(data as MissionConfigRow) : null;
}

/**
 * Knowledge grounding, in the exact priority order docs/INTEGRATION_ARCHITECTURE.md §7 specifies:
 * Mission resource bindings first, then Stage curriculum, then Admin-selected scope. Capped at 12
 * items total — the performance guidance explicitly says not to load the whole curriculum per turn.
 * Cross-stage grounding (§7's optional 4th tier) is not built: no admin policy toggle for it exists
 * in this pass's config shape, so it is simply never enabled rather than half-implemented.
 */
export async function getKnowledgeContext(organizationId: string, stageId: string, missionId: string, scope: CoachKnowledgeScope): Promise<Array<{ id: string; title: string; excerpt?: string }>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const results: Array<{ id: string; title: string; excerpt?: string }> = [];
  const seen = new Set<string>();
  const add = (id: string, title: string, excerpt?: string | null) => { if (!seen.has(id)) { seen.add(id); results.push({ id, title, excerpt: excerpt ?? undefined }); } };

  if (scope.allowMissionBindings) {
    const { data: bindings } = await admin.from("learning_mission_resource_bindings").select("resource_type,resource_id").eq("organization_id", organizationId).eq("mission_id", missionId);
    const docIds = ((bindings ?? []) as { resource_type: string; resource_id: string }[]).filter((b) => b.resource_type === "document").map((b) => b.resource_id);
    if (docIds.length) {
      const { data: docs } = await admin.from("curriculum_documents").select("id,title,summary").eq("organization_id", organizationId).in("id", docIds);
      for (const d of (docs ?? []) as { id: string; title: string; summary: string }[]) add(d.id, d.title, d.summary);
    }
  }

  if (scope.allowStageCurriculum && results.length < 12) {
    const { data: placements } = await admin.from("career_stage_resources").select("id,title_override,summary").eq("organization_id", organizationId).eq("stage_id", stageId).eq("status", "active").order("position", { ascending: true }).limit(12 - results.length);
    for (const p of (placements ?? []) as { id: string; title_override: string | null; summary: string | null }[]) add(p.id, p.title_override ?? "Tài liệu Stage", p.summary);
  }

  if (scope.resourceIds.length && results.length < 12) {
    const remaining = scope.resourceIds.filter((id) => !seen.has(id)).slice(0, 12 - results.length);
    if (remaining.length) {
      const { data: docs } = await admin.from("curriculum_documents").select("id,title,summary").eq("organization_id", organizationId).in("id", remaining);
      for (const d of (docs ?? []) as { id: string; title: string; summary: string }[]) add(d.id, d.title, d.summary);
    }
  }

  return results.slice(0, 12);
}

/** Bounded message history for one (learner, mission) — capped to the last 40 turns so a long-running Mission never re-sends its entire chat history to the model or the client on every turn. */
const MAX_STORED_MESSAGES = 40;

export async function appendConversation(organizationId: string, learnerId: string, missionId: string, message: CoachConversationMessage): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: existing } = await admin.from("coach_conversations").select("id,messages").eq("organization_id", organizationId).eq("learner_id", learnerId).eq("mission_id", missionId).maybeSingle();
  const current = ((existing as { messages: CoachConversationMessage[] } | null)?.messages ?? []) as CoachConversationMessage[];
  const next = [...current, message].slice(-MAX_STORED_MESSAGES);
  await admin.from("coach_conversations").upsert(
    { organization_id: organizationId, learner_id: learnerId, mission_id: missionId, messages: next },
    { onConflict: "organization_id,learner_id,mission_id" }
  );
}

export async function getConversation(organizationId: string, learnerId: string, missionId: string): Promise<CoachConversationMessage[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("coach_conversations").select("messages").eq("organization_id", organizationId).eq("learner_id", learnerId).eq("mission_id", missionId).maybeSingle();
  return ((data as { messages: CoachConversationMessage[] } | null)?.messages ?? []) as CoachConversationMessage[];
}

export async function getRuntimeContext(organizationId: string, learnerId: string, stageId: string, missionId: string): Promise<CoachRuntimeContext | null> {
  const profile = await getPublishedStageProfile(organizationId, stageId);
  if (!profile) return null;
  const missionConfig = await getMissionConfig(organizationId, profile.id, missionId);
  if (!missionConfig) return null;
  const memory = await getLearnerMemory(organizationId, learnerId);
  return { organizationId, learnerId, stageId, missionId, profile, missionConfig, memory };
}
