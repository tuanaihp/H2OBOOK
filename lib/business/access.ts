// Pure feature-decision logic — ported from
// v5/13-h2obook-business-growth-commerce-engine-v1/src/core/access.ts, trimmed to the
// BusinessFeature vocabulary this pass actually implements (admin_* variants removed — the
// existing Admin pages are untouched and are not gated through this system).
import type { BusinessAccessSnapshot, BusinessFeature, CareerStage, FeatureDecision } from "./types";

const PLAN_FEATURES: Record<BusinessAccessSnapshot["plan"], BusinessFeature[]> = {
  basic: ["public_store", "my_orders", "my_entitlements"],
  membership_professional: ["public_store", "business_command_center", "offer_builder", "pricing_builder", "sales_script_vault", "my_orders", "my_membership", "my_entitlements"],
  membership_marketing: ["public_store", "business_command_center", "content_90_days", "growth_campaigns", "growth_reader", "my_orders", "my_membership", "my_entitlements"],
  business_pro: ["public_store", "business_command_center", "offer_builder", "pricing_builder", "lead_tracker", "sales_pipeline", "sales_script_vault", "content_90_days", "growth_campaigns", "growth_reader", "customer_care", "revenue_dashboard", "service_profit_calculator", "makeup_crm", "business_automation", "my_orders", "my_membership", "my_entitlements"],
  academy_pro: ["public_store", "business_command_center", "offer_builder", "pricing_builder", "lead_tracker", "sales_pipeline", "sales_script_vault", "content_90_days", "growth_campaigns", "growth_reader", "customer_care", "revenue_dashboard", "service_profit_calculator", "makeup_crm", "business_automation", "marketplace_listing", "licensing_portal", "my_orders", "my_membership", "my_entitlements"],
  white_label: ["public_store", "business_command_center", "offer_builder", "pricing_builder", "lead_tracker", "sales_pipeline", "sales_script_vault", "content_90_days", "growth_campaigns", "growth_reader", "customer_care", "revenue_dashboard", "service_profit_calculator", "makeup_crm", "business_automation", "marketplace_listing", "licensing_portal", "white_label_portal", "my_orders", "my_membership", "my_entitlements"]
};

const STAGE_FEATURES: Record<CareerStage, BusinessFeature[]> = {
  1: ["public_store"],
  2: ["business_command_center"],
  3: ["offer_builder"],
  4: ["pricing_builder"],
  5: ["lead_tracker", "sales_pipeline", "sales_script_vault", "content_90_days", "growth_campaigns"],
  6: ["customer_care", "revenue_dashboard", "service_profit_calculator", "makeup_crm", "business_automation"]
};

function stageGrant(snapshot: BusinessAccessSnapshot, feature: BusinessFeature): CareerStage | null {
  for (const stage of snapshot.unlockedStages) if (STAGE_FEATURES[stage].includes(feature)) return stage;
  return null;
}

export function decideBusinessFeature(snapshot: BusinessAccessSnapshot, feature: BusinessFeature): FeatureDecision {
  if (feature === "public_store") return { feature, allowed: true, source: "free", reason: "Knowledge Store là khu vực công khai." };
  if (snapshot.role === "admin" || snapshot.role === "owner") return { feature, allowed: true, source: "role", reason: "Admin/Owner có toàn quyền Business trong workspace." };
  if (snapshot.manualFeatures.includes(feature)) return { feature, allowed: true, source: "manual_grant", reason: "Được Admin cấp trực tiếp." };
  if (snapshot.purchasedFeatures.includes(feature)) return { feature, allowed: true, source: "purchase", reason: "Được cấp bởi sản phẩm đã mua." };
  if (snapshot.activeMembership && PLAN_FEATURES[snapshot.plan].includes(feature)) return { feature, allowed: true, source: "membership", reason: `Được mở bởi gói ${snapshot.plan}.` };
  const stage = stageGrant(snapshot, feature);
  if (stage !== null) return { feature, allowed: true, source: "stage", reason: `Đã mở khi đạt Giai đoạn ${stage}.` };
  return { feature, allowed: false, reason: "Tài khoản chưa có quyền sử dụng tính năng này.", unlockHint: "Hoàn thành giai đoạn phù hợp, mua khóa lẻ hoặc nâng cấp gói Business." };
}

const ALL_FEATURES: BusinessFeature[] = [
  "public_store", "business_command_center", "offer_builder", "pricing_builder", "lead_tracker", "sales_pipeline",
  "sales_script_vault", "content_90_days", "growth_campaigns", "growth_reader", "customer_care", "revenue_dashboard",
  "service_profit_calculator", "makeup_crm", "business_automation", "my_orders", "my_membership", "my_entitlements",
  "marketplace_listing", "licensing_portal", "white_label_portal"
];

export function getAllowedBusinessFeatures(snapshot: BusinessAccessSnapshot): FeatureDecision[] {
  return ALL_FEATURES.map((feature) => decideBusinessFeature(snapshot, feature));
}
