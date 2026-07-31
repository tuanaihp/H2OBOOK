export type BusinessSurface =
  | "analytics"
  | "growth-reader"
  | "licensing"
  | "marketplace-studio"
  | "membership"
  | "orders"
  | "store"
  | "white-label";

export type BusinessStageStatus = "ready" | "attention" | "blocked" | "optional";

export type BusinessRole =
  | "owner"
  | "admin"
  | "finance"
  | "marketing"
  | "content_manager"
  | "platform_admin";

export type BusinessSurfaceDefinition = {
  id: BusinessSurface;
  label: string;
  shortLabel: string;
  description: string;
  route: string;
  previewRoute: string;
  stage: number;
  status: BusinessStageStatus;
  roles: BusinessRole[];
  dependencies: BusinessSurface[];
  inputs: string[];
  outputs: string[];
};

export type BusinessAnalyticsEvent = {
  name:
    | "business_surface_viewed"
    | "business_action_clicked"
    | "business_pipeline_advanced"
    | "business_checkout_started"
    | "business_payment_confirmed"
    | "business_entitlement_granted"
    | "business_campaign_saved"
    | "business_listing_submitted"
    | "business_portal_updated";
  surface: BusinessSurface;
  action?: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type BusinessPipelineStage = {
  id: string;
  label: string;
  description: string;
  surface: BusinessSurface;
};

export type DemoProduct = {
  id: string;
  name: string;
  type: "book" | "template" | "membership" | "bundle";
  price: number;
  compareAtPrice?: number;
  sales: number;
  revenue: number;
  status: "active" | "draft" | "hidden";
  cover: string;
  description: string;
};

export type DemoOrder = {
  id: string;
  code: string;
  customer: string;
  email: string;
  product: string;
  total: number;
  method: "qr" | "bank_transfer" | "card" | "manual";
  payment: "pending" | "paid" | "failed" | "refunded";
  entitlement: "pending" | "granted" | "revoked";
  createdAt: string;
};

export type DemoMembership = {
  id: string;
  member: string;
  plan: string;
  cycle: "month" | "year";
  value: number;
  renewsAt: string;
  status: "active" | "trial" | "past_due" | "cancelled";
};

export type DemoLicense = {
  id: string;
  partner: string;
  template: string;
  model: "one_time" | "subscription" | "revenue_share";
  seats: number;
  clonesUsed: number;
  cloneLimit: number;
  revenue: number;
  royaltyRate: number;
  status: "active" | "draft" | "suspended" | "expired";
};

export type DemoPortal = {
  id: string;
  name: string;
  domain: string;
  books: number;
  members: number;
  plan: "academy" | "business" | "enterprise";
  status: "active" | "draft" | "maintenance";
  primary: string;
  accent: string;
};
