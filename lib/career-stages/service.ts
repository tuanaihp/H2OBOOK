import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { learningPaths } from "@/lib/public-site/content";
import type { CareerStage, CareerStageProgram, CareerStageResource, RequirementType, StageResourceAccess, StageResourceType, StageStatus, StageSurfaceTag, UnlockMode } from "./types";

type StageRow = {
  id: string; slug: string; position: number; index_label: string | null; title: string;
  subtitle: string | null; description: string | null; duration_label: string | null;
  skills: string[] | null; status: string; published_at: string | null; archived_at: string | null;
};
type ResourceRow = {
  id: string; stage_id: string; resource_type: string; resource_id: string; title_override: string | null;
  summary: string | null; href: string | null; position: number; access: string; status: string;
  unlock_mode: string | null; prerequisite_binding_id: string | null; required_progress: number | null;
  unlock_at: string | null; requirement_type: string | null; display_locations: string[] | null;
  program_id: string | null; node_id: string | null; surface: string | null; is_featured: boolean | null;
};
type ProgramRow = {
  id: string; stage_id: string; parent_id: string | null; slug: string; title: string;
  description: string | null; position: number; status: string;
};

function mapProgram(row: ProgramRow): CareerStageProgram {
  return {
    id: String(row.id),
    stageId: String(row.stage_id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description ?? ""),
    position: Number(row.position ?? 0),
    status: row.status as StageStatus
  };
}

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
    status: row.status as StageStatus,
    unlockMode: (row.unlock_mode ?? "immediate") as UnlockMode,
    prerequisiteBindingId: row.prerequisite_binding_id ? String(row.prerequisite_binding_id) : null,
    requiredProgress: row.required_progress === null || row.required_progress === undefined ? null : Number(row.required_progress),
    unlockAt: row.unlock_at ? String(row.unlock_at) : null,
    requirementType: (row.requirement_type ?? "required") as RequirementType,
    displayLocations: Array.isArray(row.display_locations) ? row.display_locations.map(String) : ["library", "journey"],
    programId: row.program_id ? String(row.program_id) : null,
    nodeId: row.node_id ? String(row.node_id) : null,
    surface: (row.surface as StageSurfaceTag | null) ?? null,
    isFeatured: Boolean(row.is_featured)
  };
}

function mapStage(row: StageRow, resources: ResourceRow[], programs: ProgramRow[]): CareerStage {
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
    resources: resources.filter((resource) => String(resource.stage_id) === String(row.id)).map(mapResource).sort((a, b) => a.position - b.position),
    programs: programs.filter((program) => String(program.stage_id) === String(row.id)).map(mapProgram).sort((a, b) => a.position - b.position),
    publishedAt: row.published_at ? String(row.published_at) : null,
    archivedAt: row.archived_at ? String(row.archived_at) : null
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
  const [{ data: stageRows }, { data: resourceRows }, { data: programRows }] = await Promise.all([
    admin.from("career_stages").select("id,slug,position,index_label,title,subtitle,description,duration_label,skills,status,published_at,archived_at").eq("organization_id", organizationId).neq("status", "archived").order("position", { ascending: true }),
    admin.from("career_stage_resources").select("id,stage_id,resource_type,resource_id,title_override,summary,href,position,access,status,unlock_mode,prerequisite_binding_id,required_progress,unlock_at,requirement_type,display_locations,program_id,node_id,surface,is_featured").eq("organization_id", organizationId).neq("status", "archived").order("position", { ascending: true }),
    admin.from("career_stage_programs").select("id,stage_id,parent_id,slug,title,description,position,status").eq("organization_id", organizationId).neq("status", "archived").order("position", { ascending: true })
  ]);
  const stages = (stageRows ?? []) as StageRow[];
  const resources = (resourceRows ?? []) as ResourceRow[];
  const programs = (programRows ?? []) as ProgramRow[];
  const visible = options?.includeHidden ? stages : stages.filter((row) => row.status === "active");
  const visibleResources = options?.includeHidden ? resources : resources.filter((row) => row.status === "active");
  const visiblePrograms = options?.includeHidden ? programs : programs.filter((row) => row.status === "active");
  return visible.map((row) => mapStage(row, visibleResources, visiblePrograms));
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
