export type GrowthRecommendationKind = "included" | "premium_resource" | "course" | "membership";

export interface GrowthRecommendation {
  id: string;
  kind: GrowthRecommendationKind;
  title: string;
  subtitle: string | null;
  reason: string;
  currentGap: string | null;
  benefits: string[];
  priceLabel: string | null;
  ctaLabel: string;
  href: string;
}
