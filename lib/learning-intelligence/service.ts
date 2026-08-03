import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient;

export const STAFF_ROLES = ["owner", "admin", "teacher"] as const;

export type BlockRecord = {
  id: string;
  sectionId: string;
  type: string;
  title: string;
  position: number;
  visibility: "all_entitled" | "preview" | "instructor" | "admin";
  required: boolean;
  estimatedMinutes: number;
  completionWeight: number;
  payload: Record<string, unknown>;
};

export type SectionRecord = { id: string; title: string; description: string; position: number; icon: string; required: boolean; blocks: BlockRecord[] };

export type KnowledgeSpaceManifest = {
  id: string;
  slug: string;
  contentItemId: string;
  title: string;
  subtitle: string;
  description: string;
  spaceType: string;
  heroStyle: string;
  instructorName: string;
  estimatedMinutes: number;
  assistantEnabled: boolean;
  certificateEnabled: boolean;
  sharingEnabled: boolean;
  activeVersionId: string | null;
  versionNumber: number | null;
  sections: SectionRecord[];
  progress: { percent: number; masteryPercent: number; practicePercent: number; confidencePercent: number; status: string; lastBlockId: string | null } | null;
  blockProgress: Record<string, { percent: number; completedAt: string | null; lastPositionSeconds: number | null }>;
};

function mapBlock(row: Record<string, unknown>): BlockRecord {
  return {
    id: String(row.id),
    sectionId: String(row.section_id),
    type: String(row.block_type),
    title: String(row.title ?? ""),
    position: Number(row.position ?? 0),
    visibility: String(row.visibility ?? "all_entitled") as BlockRecord["visibility"],
    required: Boolean(row.required),
    estimatedMinutes: Number(row.estimated_minutes ?? 0),
    completionWeight: Number(row.completion_weight ?? 1),
    payload: (row.payload as Record<string, unknown>) ?? {}
  };
}

/**
 * Assembles the published manifest for a Knowledge Space using a user-scoped Supabase client
 * (created via createSupabaseServerClient) so RLS alone decides what the caller may see — no
 * entitlement logic is duplicated in application code here, per the module's own access rule.
 */
export async function buildStudentManifest(userClient: Client, organizationId: string, spaceSlug: string, userId: string): Promise<KnowledgeSpaceManifest | null> {
  const { data: space } = await userClient
    .from("knowledge_spaces")
    .select("id,slug,title,subtitle,description,space_type,hero_style,instructor_name,estimated_minutes,assistant_enabled,certificate_enabled,sharing_enabled,active_version_id,content_item_id")
    .eq("organization_id", organizationId).eq("slug", spaceSlug).maybeSingle();
  if (!space?.active_version_id) return null;

  const { data: version } = await userClient.from("knowledge_space_versions").select("id,version_number,status").eq("id", space.active_version_id).maybeSingle();
  if (!version || version.status !== "published") return null;

  const { data: sectionRows } = await userClient.from("learning_sections").select("id,title,description,position,icon,required").eq("version_id", version.id).order("position", { ascending: true });
  const sectionIds = (sectionRows ?? []).map((row) => String(row.id));
  const { data: blockRows } = sectionIds.length
    ? await userClient.from("learning_blocks").select("id,section_id,block_type,title,position,visibility,required,estimated_minutes,completion_weight,payload").in("section_id", sectionIds).order("position", { ascending: true })
    : { data: [] };

  const sections: SectionRecord[] = (sectionRows ?? []).map((row) => ({
    id: String(row.id), title: String(row.title), description: String(row.description ?? ""), position: Number(row.position ?? 0), icon: String(row.icon ?? ""), required: Boolean(row.required),
    blocks: (blockRows ?? []).filter((block) => block.section_id === row.id).map(mapBlock)
  }));

  const { data: progressRow } = await userClient.from("knowledge_space_progress").select("percent,mastery_percent,practice_percent,confidence_percent,status,last_block_id").eq("user_id", userId).eq("knowledge_space_id", space.id).maybeSingle();
  const blockIds = (blockRows ?? []).map((row) => String(row.id));
  const { data: blockProgressRows } = blockIds.length
    ? await userClient.from("block_progress").select("block_id,percent,completed_at,last_position_seconds").eq("user_id", userId).in("block_id", blockIds)
    : { data: [] };

  return {
    id: String(space.id), slug: String(space.slug), contentItemId: String(space.content_item_id), title: String(space.title), subtitle: String(space.subtitle ?? ""), description: String(space.description ?? ""),
    spaceType: String(space.space_type), heroStyle: String(space.hero_style ?? "brain"), instructorName: String(space.instructor_name ?? ""),
    estimatedMinutes: Number(space.estimated_minutes ?? 0), assistantEnabled: Boolean(space.assistant_enabled), certificateEnabled: Boolean(space.certificate_enabled), sharingEnabled: Boolean(space.sharing_enabled),
    activeVersionId: String(version.id), versionNumber: Number(version.version_number),
    sections,
    progress: progressRow ? { percent: Number(progressRow.percent ?? 0), masteryPercent: Number(progressRow.mastery_percent ?? 0), practicePercent: Number(progressRow.practice_percent ?? 0), confidencePercent: Number(progressRow.confidence_percent ?? 0), status: String(progressRow.status ?? "not_started"), lastBlockId: progressRow.last_block_id ? String(progressRow.last_block_id) : null } : null,
    blockProgress: Object.fromEntries((blockProgressRows ?? []).map((row) => [String(row.block_id), { percent: Number(row.percent ?? 0), completedAt: row.completed_at ? String(row.completed_at) : null, lastPositionSeconds: row.last_position_seconds == null ? null : Number(row.last_position_seconds) }]))
  };
}

/**
 * Recomputes the aggregate Knowledge Space progress for one learner from their block_progress
 * rows, weighted by each block's completion_weight. Called after every block_progress upsert.
 */
export async function recomputeSpaceProgress(userClient: Client, organizationId: string, userId: string, knowledgeSpaceId: string, versionId: string) {
  const { data: sectionRows } = await userClient.from("learning_sections").select("id").eq("version_id", versionId);
  const sectionIds = (sectionRows ?? []).map((row) => String(row.id));
  const { data: blockRows } = sectionIds.length
    ? await userClient.from("learning_blocks").select("id,completion_weight").in("section_id", sectionIds)
    : { data: [] };
  const blocks = blockRows ?? [];
  const totalWeight = blocks.reduce((sum, block) => sum + Number(block.completion_weight ?? 1), 0) || 1;
  const blockIds = blocks.map((block) => String(block.id));
  const { data: progressRows } = blockIds.length
    ? await userClient.from("block_progress").select("block_id,percent").eq("user_id", userId).in("block_id", blockIds)
    : { data: [] };
  const progressMap = new Map((progressRows ?? []).map((row) => [String(row.block_id), Number(row.percent ?? 0)]));
  const earnedWeight = blocks.reduce((sum, block) => sum + (Number(block.completion_weight ?? 1) * (progressMap.get(String(block.id)) ?? 0)) / 100, 0);
  const percent = Math.round((earnedWeight / totalWeight) * 100);
  const status = percent >= 100 ? "completed" : percent > 0 ? "in_progress" : "not_started";

  await userClient.from("knowledge_space_progress").upsert({
    organization_id: organizationId, user_id: userId, knowledge_space_id: knowledgeSpaceId, version_id: versionId,
    percent, mastery_percent: percent, practice_percent: percent, confidence_percent: percent, status,
    started_at: percent > 0 ? new Date().toISOString() : null, completed_at: percent >= 100 ? new Date().toISOString() : null, updated_at: new Date().toISOString()
  }, { onConflict: "user_id,knowledge_space_id" });

  return { percent, status };
}

export function slugify(input: string) {
  return input.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `space-${Date.now()}`;
}
