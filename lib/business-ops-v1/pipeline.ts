import type { BusinessPipelineStage } from "./types";

export const businessPipeline: BusinessPipelineStage[] = [
  { id: "product", label: "Sản phẩm", description: "Sách, template, membership hoặc combo", surface: "store" },
  { id: "campaign", label: "Chiến dịch", description: "Reader, lead gate, CTA và UTM", surface: "growth-reader" },
  { id: "order", label: "Đơn hàng", description: "Checkout, payment và idempotency", surface: "orders" },
  { id: "membership", label: "Membership", description: "Subscription, quota và gia hạn", surface: "membership" },
  { id: "license", label: "Cấp phép", description: "Đối tác, clone limit và royalty", surface: "licensing" },
  { id: "marketplace", label: "Marketplace", description: "Listing, quality và moderation", surface: "marketplace-studio" },
  { id: "portal", label: "White-label", description: "Domain, brand và thư viện đối tác", surface: "white-label" },
  { id: "insight", label: "Phân tích", description: "Funnel, doanh thu và attribution", surface: "analytics" },
];
