// The curriculum map: which stages exist, and which material belongs to each. Access — whether a
// given student may actually open a resource — is decided elsewhere (entitlements, and the stage
// unlock rules in lib/student/stage-access.ts). This module only answers "what belongs where".

export const STAGE_RESOURCE_TYPES = ["book", "course", "publication", "template", "knowledge_space", "roadmap", "link", "asset"] as const;
export type StageResourceType = (typeof STAGE_RESOURCE_TYPES)[number];

export const STAGE_RESOURCE_ACCESS = ["free_preview", "stage_locked", "entitlement_only"] as const;
export type StageResourceAccess = (typeof STAGE_RESOURCE_ACCESS)[number];

export const STAGE_STATUSES = ["active", "hidden", "archived"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const UNLOCK_MODES = ["immediate", "stage_active", "after_resource", "progress_gte", "date", "manual"] as const;
export type UnlockMode = (typeof UNLOCK_MODES)[number];

export const REQUIREMENT_TYPES = ["required", "optional", "bonus"] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export interface CareerStageResource {
  id: string;
  stageId: string;
  resourceType: StageResourceType;
  resourceId: string;
  title: string;
  summary: string;
  href: string;
  position: number;
  access: StageResourceAccess;
  status: StageStatus;
  // Migration 0034 (Content Access Engine V1). `access` decides whether the stage matters at all;
  // these refine when the resource opens once it does.
  unlockMode: UnlockMode;
  prerequisiteBindingId: string | null;
  requiredProgress: number | null;
  unlockAt: string | null;
  requirementType: RequirementType;
  displayLocations: string[];
  // Migration 0040. Optional grouping — null means the resource sits directly under the stage,
  // exactly as every resource did before this column existed. Superseded by nodeId (migration 0041)
  // going forward; kept read-only here because migration 0040 does not drop the column or its data.
  programId: string | null;
  // Migration 0041 (Academy Control Center V2). nodeId points into academy_stage_nodes
  // (program/module/group) rather than career_stage_programs. surface is which student-facing nav
  // section (Learn/Create/Business/Coaching) the resource belongs to — orthogonal to displayLocations,
  // which is where within a page it renders.
  nodeId: string | null;
  surface: StageSurfaceTag | null;
  isFeatured: boolean;
}

export const STAGE_SURFACES = ["learn", "create", "business", "coaching"] as const;
export type StageSurfaceTag = (typeof STAGE_SURFACES)[number];

/**
 * A named group of resources within a stage — "Module 1: Nền tảng" rather than one long flat list.
 * One level of nesting only: a program may contain modules (parentId set), a module may not
 * contain further children. Enforced by a trigger in migration 0040, not by this type.
 */
export interface CareerStageProgram {
  id: string;
  stageId: string;
  parentId: string | null;
  slug: string;
  title: string;
  description: string;
  position: number;
  status: StageStatus;
}

export interface CareerStageProgramInput {
  slug: string;
  title: string;
  parentId?: string | null;
  description?: string;
  position?: number;
  status?: StageStatus;
}

export interface CareerStage {
  id: string;
  slug: string;
  position: number;
  indexLabel: string;
  title: string;
  subtitle: string;
  description: string;
  durationLabel: string;
  skills: string[];
  status: StageStatus;
  resources: CareerStageResource[];
  programs: CareerStageProgram[];
}

export interface CareerStageInput {
  slug: string;
  title: string;
  position?: number;
  indexLabel?: string;
  subtitle?: string;
  description?: string;
  durationLabel?: string;
  skills?: string[];
  status?: StageStatus;
}

export interface CareerStageResourceInput {
  resourceType: StageResourceType;
  resourceId: string;
  title?: string;
  summary?: string;
  href?: string;
  position?: number;
  access?: StageResourceAccess;
  status?: StageStatus;
  unlockMode?: UnlockMode;
  prerequisiteBindingId?: string | null;
  requiredProgress?: number | null;
  unlockAt?: string | null;
  requirementType?: RequirementType;
  displayLocations?: string[];
  programId?: string | null;
  nodeId?: string | null;
  surface?: StageSurfaceTag | null;
  isFeatured?: boolean;
}

export const DISPLAY_LOCATIONS = ["library", "journey", "smart_home"] as const;
export type DisplayLocation = (typeof DISPLAY_LOCATIONS)[number];

export function isUnlockMode(value: unknown): value is UnlockMode {
  return typeof value === "string" && (UNLOCK_MODES as readonly string[]).includes(value);
}

export function isRequirementType(value: unknown): value is RequirementType {
  return typeof value === "string" && (REQUIREMENT_TYPES as readonly string[]).includes(value);
}

/** Keeps unknown location names out of the array; an empty result means "nowhere", which is valid. */
export function toDisplayLocations(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string" && (DISPLAY_LOCATIONS as readonly string[]).includes(item));
}

export function isStageResourceType(value: unknown): value is StageResourceType {
  return typeof value === "string" && (STAGE_RESOURCE_TYPES as readonly string[]).includes(value);
}

export function isStageResourceAccess(value: unknown): value is StageResourceAccess {
  return typeof value === "string" && (STAGE_RESOURCE_ACCESS as readonly string[]).includes(value);
}

export function isStageSurfaceTag(value: unknown): value is StageSurfaceTag {
  return typeof value === "string" && (STAGE_SURFACES as readonly string[]).includes(value);
}

export function isStageStatus(value: unknown): value is StageStatus {
  return typeof value === "string" && (STAGE_STATUSES as readonly string[]).includes(value);
}

/** A slug the unique(organization_id, slug) constraint and the URL router can both live with. */
export function toStageSlug(value: string): string {
  return value
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
