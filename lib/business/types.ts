// H2OBOOK Business Growth & Commerce Engine V1 (adapted from
// v5/13-h2obook-business-growth-commerce-engine-v1/src/core/types.ts). The source module's
// AccountRole includes mentor/instructor/reviewer/training_manager — none of those exist as
// real public.member_role values (see lib/teaching/types.ts for the same reconciliation done in
// module 12). This module is a student-facing surface, so only "student" and the untouched
// admin/owner path matter here; mentor/instructor visibility into a student's business data is
// explicitly deferred (see the integration report).
export type BusinessRole = "student" | "admin" | "owner";

export type CommercialPlan =
  | "basic"
  | "membership_professional"
  | "membership_marketing"
  | "business_pro"
  | "academy_pro"
  | "white_label";

export type CareerStage = 1 | 2 | 3 | 4 | 5 | 6;

export type BusinessFeature =
  | "public_store"
  | "business_command_center"
  | "offer_builder"
  | "pricing_builder"
  | "lead_tracker"
  | "sales_pipeline"
  | "sales_script_vault"
  | "content_90_days"
  | "growth_campaigns"
  | "growth_reader"
  | "customer_care"
  | "revenue_dashboard"
  | "service_profit_calculator"
  | "makeup_crm"
  | "business_automation"
  | "my_orders"
  | "my_membership"
  | "my_entitlements"
  | "marketplace_listing"
  | "licensing_portal"
  | "white_label_portal";

export type AccessSource = "free" | "role" | "membership" | "purchase" | "stage" | "manual_grant";

export interface FeatureDecision {
  feature: BusinessFeature;
  allowed: boolean;
  source?: AccessSource;
  reason: string;
  unlockHint?: string;
}

export interface BusinessAccessSnapshot {
  userId: string;
  organizationId: string;
  role: BusinessRole;
  plan: CommercialPlan;
  activeMembership: boolean;
  unlockedStages: CareerStage[];
  purchasedFeatures: BusinessFeature[];
  manualFeatures: BusinessFeature[];
}

export type OpportunityStatus = "new" | "contacted" | "consulting" | "proposal" | "booked" | "won" | "lost";

export interface BusinessOpportunity {
  id: string;
  ownerId: string;
  customerName: string;
  customerContact: Record<string, string>;
  serviceName: string;
  estimatedValue: number;
  status: OpportunityStatus;
  source: string | null;
  nextActionAt: string | null;
  notes: string | null;
  sourceDomain: "learn" | "create" | "teach" | "manual";
  updatedAt: string;
}

export interface BusinessGoal {
  id: string;
  ownerId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: "lead" | "booking" | "revenue" | "content" | "repeat_customer";
  dueAt: string | null;
  status: "active" | "completed" | "paused";
}

export interface BusinessTask {
  id: string;
  title: string;
  description: string;
  priority: "urgent" | "high" | "normal";
  feature: BusinessFeature;
  completed: boolean;
}

export interface BusinessMetrics {
  leads: number;
  qualifiedLeads: number;
  bookings: number;
  revenue: number;
  repeatCustomers: number;
  publishedContent: number;
}

export interface BusinessCommandView {
  headline: string;
  stageLabel: string;
  progress: number;
  metrics: BusinessMetrics;
  tasks: BusinessTask[];
  unlockedFeatures: FeatureDecision[];
  nextMilestone: string;
}

export interface CreateAssetReference {
  projectId: string;
  assetType: "portfolio" | "brand_kit" | "pricing" | "content_plan" | "sales_script";
  title: string;
  status: "draft" | "approved" | "published";
}
