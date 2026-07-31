import type { PublicBook, PublicCourse, PublicStrategy } from "@/lib/public-site/content";

export type PublicHomeSectionKey =
  | "ecosystem"
  | "journey-planner"
  | "books"
  | "courses"
  | "career-path"
  | "student-command"
  | "strategy"
  | "real-world"
  | "success-stories"
  | "membership"
  | "final-cta";

export type PublicHomeMetric = {
  id: string;
  label: string;
  value: string;
  helper?: string;
};

export type PublicHomeConfig = {
  version: 3;
  sectionOrder: PublicHomeSectionKey[];
  hiddenSections: PublicHomeSectionKey[];
  featuredBookSlugs: string[];
  featuredCourseSlugs: string[];
  featuredStrategySlugs: string[];
  heroMetrics: PublicHomeMetric[];
  socialProof: {
    students: number;
    yearsExperience: number;
    completionRate: number;
    practicalEvents: number;
  };
  conversion: {
    primaryCtaHref: string;
    primaryCtaLabel: string;
    secondaryCtaHref: string;
    secondaryCtaLabel: string;
  };
  updatedAt: string;
};

export type JourneyStage = "new" | "first-clients" | "professional" | "team" | "academy";
export type JourneyGoal = "technique" | "clients" | "brand" | "business" | "automation";

export type JourneyRecommendation = {
  stage: JourneyStage;
  goal: JourneyGoal;
  title: string;
  summary: string;
  href: string;
  relatedBookSlugs: string[];
  relatedCourseSlugs: string[];
  relatedStrategySlugs: string[];
};

export type PublicHomeViewModel = {
  config: PublicHomeConfig;
  books: PublicBook[];
  courses: PublicCourse[];
  strategies: PublicStrategy[];
  recommendations: JourneyRecommendation[];
  source: "fallback" | "supabase";
};
