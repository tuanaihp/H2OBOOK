export type PublicAcademyPageKey = "about" | "books" | "courses" | "learning-paths" | "strategies" | "membership";

export type PublicAcademyMetric = {
  label: string;
  value: string;
  helper?: string;
};

export type PublicAcademyCatalogKind = "book" | "course" | "strategy";

export type PublicAcademyCatalogItem = {
  id: string;
  slug: string;
  href: string;
  kind: PublicAcademyCatalogKind;
  title: string;
  subtitle: string;
  category: string;
  level?: string;
  accent: string;
  price?: number;
  tags: string[];
  metrics: PublicAcademyMetric[];
  outcomes: string[];
  featured?: boolean;
};

export type PublicAcademyLearningPath = {
  id: string;
  index: string;
  duration: string;
  title: string;
  description: string;
  skills: string[];
  recommendationHref: string;
  active?: boolean;
};

export type PublicAcademyValue = {
  id: string;
  title: string;
  description: string;
  icon: "book" | "practice" | "people" | "growth";
};

export type PublicMembershipPlan = {
  id: string;
  productId?: string;
  name: string;
  price: number;
  period: "tháng" | "năm";
  description: string;
  features: string[];
  featured?: boolean;
  audience: string;
  entitlementKeys: string[];
  checkoutEnabled: boolean;
};

export type PublicAcademyConfig = {
  version: 5;
  pageTitles: Record<PublicAcademyPageKey, {
    eyebrow: string;
    title: string;
    description: string;
  }>;
  featuredBookSlugs: string[];
  featuredCourseSlugs: string[];
  featuredStrategySlugs: string[];
  conversion: {
    journeyHref: string;
    journeyLabel: string;
    academyHref: string;
    academyLabel: string;
    loginHref: string;
    loginLabel: string;
  };
  about: {
    founderName: string;
    founderRole: string;
    founderDescription: string;
    experienceYears: string;
    heroTitle: string;
    heroDescription: string;
  };
  membership: {
    checkoutTitle: string;
    checkoutDescription: string;
    privacyTitle: string;
    privacyDescription: string;
    finalTitle: string;
    finalHighlight: string;
  };
  auth: {
    brandTitle: string;
    brandDescription: string;
    trustTitle: string;
    trustDescription: string;
    loginTitle: string;
    loginDescription: string;
  };
  updatedAt: string;
};

export type PublicAcademyViewModel = {
  config: PublicAcademyConfig;
  books: PublicAcademyCatalogItem[];
  courses: PublicAcademyCatalogItem[];
  strategies: PublicAcademyCatalogItem[];
  learningPaths: PublicAcademyLearningPath[];
  values: PublicAcademyValue[];
  membershipPlans: PublicMembershipPlan[];
  source: "fallback" | "supabase";
};
