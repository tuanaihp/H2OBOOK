// Program/Module/Group structure inside a career stage, the content catalog admins pick resources
// from, and the (not-yet-consumed) Student Experience Builder config. See
// docs/academy-control-center-v2-architecture-plan.md for the full design and what was rejected.

export const STAGE_NODE_TYPES = ["program", "module", "group"] as const;
export type StageNodeType = (typeof STAGE_NODE_TYPES)[number];

export const STAGE_SURFACES = ["learn", "create", "business", "coaching"] as const;
export type StageSurface = (typeof STAGE_SURFACES)[number];

export const CONTENT_TYPES = ["book", "publication", "template", "knowledge_space", "asset"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const NODE_STATUSES = ["active", "hidden", "archived"] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const UI_CONFIG_STATUSES = ["draft", "published", "archived"] as const;
export type UiConfigStatus = (typeof UI_CONFIG_STATUSES)[number];

export interface AcademyStageNode {
  id: string;
  organizationId: string;
  stageId: string;
  parentId: string | null;
  nodeType: StageNodeType;
  title: string;
  description: string;
  position: number;
  status: NodeStatus;
  // Migration 0043. The surface this branch belongs to, or null to inherit from its parent.
  surface: StageSurface | null;
  // Resolved by walking up to the nearest ancestor with a surface set — what the branch actually
  // renders under, as opposed to what it declares. Equal to `surface` when that is set.
  effectiveSurface: StageSurface | null;
}

export interface AcademyStageNodeInput {
  stageId: string;
  parentId?: string | null;
  nodeType: StageNodeType;
  title: string;
  description?: string;
  position?: number;
  surface?: StageSurface | null;
}

export interface ContentCatalogItem {
  id: string;
  contentType: ContentType;
  sourceTable: string;
  sourceId: string;
  title: string;
  summary: string;
  coverAssetId: string | null;
  tags: string[];
  reuseCount: number;
  status: "active" | "archived";
}

export interface AttachCatalogResourceInput {
  stageId: string;
  nodeId?: string | null;
  contentItemId: string;
  surface?: StageSurface | null;
  isFeatured?: boolean;
  position?: number;
}

export interface AcademyStageUiConfig {
  id: string;
  organizationId: string;
  stageId: string;
  version: number;
  status: UiConfigStatus;
  config: StudentNavDraft;
  publishedAt: string | null;
}

export interface StudentNavItemDraft {
  key: string;
  label: string;
  icon?: string;
  route?: string;
  visible: boolean;
  locked: boolean;
  requiredStage?: number | null;
}

export interface StudentNavDraft {
  topLevel: StudentNavItemDraft[];
  notes?: string;
}

export function isStageNodeType(value: unknown): value is StageNodeType {
  return typeof value === "string" && (STAGE_NODE_TYPES as readonly string[]).includes(value);
}

export function isStageSurface(value: unknown): value is StageSurface {
  return typeof value === "string" && (STAGE_SURFACES as readonly string[]).includes(value);
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && (CONTENT_TYPES as readonly string[]).includes(value);
}
