import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildFallbackPublicHomeViewModel } from "./fallback";
import type { PublicHomeConfig, PublicHomeSectionKey, PublicHomeViewModel } from "./types";

const validSections = new Set<PublicHomeSectionKey>([
  "ecosystem",
  "journey-planner",
  "books",
  "courses",
  "career-path",
  "student-command",
  "strategy",
  "real-world",
  "success-stories",
  "membership",
  "final-cta",
]);

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asSectionArray(value: unknown): PublicHomeSectionKey[] {
  return asStringArray(value).filter((item): item is PublicHomeSectionKey => validSections.has(item as PublicHomeSectionKey));
}

function mergeConfig(base: PublicHomeConfig, payload: unknown): PublicHomeConfig {
  if (!payload || typeof payload !== "object") return base;
  const row = payload as Record<string, unknown>;
  const sectionOrder = asSectionArray(row.sectionOrder);
  const hiddenSections = asSectionArray(row.hiddenSections);
  const conversion = row.conversion && typeof row.conversion === "object" ? row.conversion as Record<string, unknown> : {};
  const socialProof = row.socialProof && typeof row.socialProof === "object" ? row.socialProof as Record<string, unknown> : {};
  return {
    ...base,
    sectionOrder: sectionOrder.length ? sectionOrder : base.sectionOrder,
    hiddenSections,
    featuredBookSlugs: asStringArray(row.featuredBookSlugs).length ? asStringArray(row.featuredBookSlugs) : base.featuredBookSlugs,
    featuredCourseSlugs: asStringArray(row.featuredCourseSlugs).length ? asStringArray(row.featuredCourseSlugs) : base.featuredCourseSlugs,
    featuredStrategySlugs: asStringArray(row.featuredStrategySlugs).length ? asStringArray(row.featuredStrategySlugs) : base.featuredStrategySlugs,
    conversion: {
      primaryCtaHref: typeof conversion.primaryCtaHref === "string" ? conversion.primaryCtaHref : base.conversion.primaryCtaHref,
      primaryCtaLabel: typeof conversion.primaryCtaLabel === "string" ? conversion.primaryCtaLabel : base.conversion.primaryCtaLabel,
      secondaryCtaHref: typeof conversion.secondaryCtaHref === "string" ? conversion.secondaryCtaHref : base.conversion.secondaryCtaHref,
      secondaryCtaLabel: typeof conversion.secondaryCtaLabel === "string" ? conversion.secondaryCtaLabel : base.conversion.secondaryCtaLabel,
    },
    socialProof: {
      students: Number(socialProof.students ?? base.socialProof.students),
      yearsExperience: Number(socialProof.yearsExperience ?? base.socialProof.yearsExperience),
      completionRate: Number(socialProof.completionRate ?? base.socialProof.completionRate),
      practicalEvents: Number(socialProof.practicalEvents ?? base.socialProof.practicalEvents),
    },
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : base.updatedAt,
  };
}

const loadPublishedConfig = unstable_cache(
  async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;

    const supabase = createSupabaseAdminClient() ?? createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase
      .from("public_home_configs")
      .select("payload,updated_at")
      .eq("slug", "main")
      .eq("status", "published")
      .maybeSingle();

    return error || !data?.payload ? null : data;
  },
  ["public-home-v3-published-config"],
  { revalidate: 300, tags: ["public-home-v3"] },
);

export async function loadPublicHomeV3(): Promise<PublicHomeViewModel> {
  const fallback = buildFallbackPublicHomeViewModel();

  try {
    const data = await loadPublishedConfig();
    if (!data?.payload) return fallback;
    return {
      ...fallback,
      config: mergeConfig(fallback.config, {
        ...(data.payload as Record<string, unknown>),
        updatedAt: data.updated_at,
      }),
      source: "supabase",
    };
  } catch {
    return fallback;
  }
}
