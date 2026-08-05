// The curriculum map: which stages exist, and which material belongs to each. Access — whether a
// given student may actually open a resource — is decided elsewhere (entitlements, and the stage
// unlock rules in lib/student/stage-access.ts). This module only answers "what belongs where".

export const STAGE_RESOURCE_TYPES = ["book", "course", "publication", "template", "knowledge_space", "roadmap", "link"] as const;
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
}

export function isStageResourceType(value: unknown): value is StageResourceType {
  return typeof value === "string" && (STAGE_RESOURCE_TYPES as readonly string[]).includes(value);
}

export function isStageResourceAccess(value: unknown): value is StageResourceAccess {
  return typeof value === "string" && (STAGE_RESOURCE_ACCESS as readonly string[]).includes(value);
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
