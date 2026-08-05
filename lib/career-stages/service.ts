import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { learningPaths } from "@/lib/public-site/content";
import type { CareerStage, CareerStageResource, StageResourceAccess, StageResourceType, StageStatus } from "./types";

type StageRow = {
  id: string; slug: string; position: number; index_label: string | null; title: string;
  subtitle: string | null; description: string | null; duration_label: string | null;
  skills: string[] | null; status: string;
};
type ResourceRow = {
  id: string; stage_id: string; resource_type: string; resource_id: string; title_override: string | null;
  summary: string | null; href: string | null; position: number; access: string; status: string;
};

function mapResource(row: ResourceRow): CareerStageResource {
  return {
    id: String(row.id),
    stageId: String(row.stage_id),
    resourceType: row.resource_type as StageResourceType,
    resourceId: String(row.resource_id),
    title: String(row.title_override ?? ""),
    summary: String(row.summary ?? ""),
    href: String(row.href ?? ""),
    position: Number(row.position ?? 0),
    access: row.access as StageResourceAccess,
    status: row.status as StageStatus
  };
}

function mapStage(row: StageRow, resources: ResourceRow[]): CareerStage {
  return {
    id: String(row.id),
    slug: String(row.slug),
    position: Number(row.position ?? 0),
    indexLabel: String(row.index_label ?? ""),
    title: String(row.title),
    subtitle: String(row.subtitle ?? ""),
    description: String(row.description ?? ""),
    durationLabel: String(row.duration_label ?? ""),
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    status: row.status as StageStatus,
    resources: resources.filter((resource) => String(resource.stage_id) === String(row.id)).map(mapResource).sort((a, b) => a.position - b.position)
  };
}

/**
 * The curriculum as configured for this organization. Returns an empty array — not the hardcoded
 * fallback — when the tables are empty, so callers can tell "not configured yet" apart from
 * "configured to be empty" and decide for themselves whether to fall back. Archived rows are
 * excluded; hidden ones are returned so the admin panel can see them, and public callers filter.
 */
export async function loadCareerStages(organizationId: string, options?: { includeHidden?: boolean }): Promise<CareerStage[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const [{ data: stageRows }, { data: resourceRows }] = await Promise.all([
    admin.from("career_stages").select("id,slug,position,index_label,title,subtitle,description,duration_label,skills,status").eq("organization_id", organizationId).neq("status", "archived").order("position", { ascending: true }),
    admin.from("career_stage_resources").select("id,stage_id,resource_type,resource_id,title_override,summary,href,position,access,status").eq("organization_id", organizationId).neq("status", "archived").order("position", { ascending: true })
  ]);
  const stages = (stageRows ?? []) as StageRow[];
  const resources = (resourceRows ?? []) as ResourceRow[];
  const visible = options?.includeHidden ? stages : stages.filter((row) => row.status === "active");
  const visibleResources = options?.includeHidden ? resources : resources.filter((row) => row.status === "active");
  return visible.map((row) => mapStage(row, visibleResources));
}

/**
 * The five stages the product shipped with, as plain input rows. This is the seed the admin panel
 * writes on first use — it is NOT a silent runtime fallback, because a fallback that looks
 * identical to real data is exactly how the /student/library demo-store problem stayed invisible.
 * Once seeded, the database is the only source; lib/public-site/content.ts keeps this array only
 * for demo mode and for this seeding step.
 */
export function defaultStageSeed() {
  return learningPaths.map((path, index) => ({
    slug: path.id,
    position: index,
    indexLabel: path.index,
    title: path.title,
    description: path.description,
    durationLabel: path.duration,
    skills: path.skills
  }));
}
