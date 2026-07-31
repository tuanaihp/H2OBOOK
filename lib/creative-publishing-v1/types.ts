export type CreativeSurface =
  | "assets"
  | "blocks"
  | "books"
  | "brand-kit"
  | "bulk-publishing"
  | "clones"
  | "content-health"
  | "design-library"
  | "editor"
  | "ingestion"
  | "publish"
  | "templates";

export type CreativeStageStatus = "ready" | "attention" | "blocked" | "optional";

export type CreativeSurfaceDefinition = {
  id: CreativeSurface;
  label: string;
  shortLabel: string;
  description: string;
  route: string;
  previewRoute: string;
  stage: number;
  status: CreativeStageStatus;
  role: "owner" | "admin" | "designer" | "content_manager";
  dependencies: CreativeSurface[];
  outputs: string[];
};

export type CreativeHandoff = {
  id: string;
  kind: "block" | "template" | "asset" | "book" | "brand";
  sourceId: string;
  targetBookId?: string;
  payload?: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type BulkCsvRow = Record<string, string>;

export type CreativeAnalyticsEvent = {
  name:
    | "creative_surface_viewed"
    | "creative_action_clicked"
    | "creative_handoff_queued"
    | "creative_job_started"
    | "creative_job_completed"
    | "creative_job_failed";
  surface: CreativeSurface;
  action?: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};
