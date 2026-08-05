import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFallbackPublicAcademyViewModel } from "./fallback";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { loadCareerStages } from "@/lib/career-stages/service";
import type {
  PublicAcademyConfig,
  PublicAcademyPageKey,
  PublicAcademyViewModel,
  PublicMembershipPlan,
} from "./types";

const validPages = new Set<PublicAcademyPageKey>([
  "about",
  "books",
  "courses",
  "learning-paths",
  "strategies",
  "membership",
]);

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function mergeConfig(base: PublicAcademyConfig, payload: unknown): PublicAcademyConfig {
  const row = objectValue(payload);
  const rawPageTitles = objectValue(row.pageTitles);
  const pageTitles = { ...base.pageTitles };

  for (const page of validPages) {
    const value = objectValue(rawPageTitles[page]);
    if (!Object.keys(value).length) continue;
    pageTitles[page] = {
      eyebrow: typeof value.eyebrow === "string" ? value.eyebrow : pageTitles[page].eyebrow,
      title: typeof value.title === "string" ? value.title : pageTitles[page].title,
      description: typeof value.description === "string" ? value.description : pageTitles[page].description,
    };
  }

  const conversion = objectValue(row.conversion);
  const about = objectValue(row.about);
  const membership = objectValue(row.membership);
  const auth = objectValue(row.auth);

  return {
    ...base,
    pageTitles,
    featuredBookSlugs: stringArray(row.featuredBookSlugs).length ? stringArray(row.featuredBookSlugs) : base.featuredBookSlugs,
    featuredCourseSlugs: stringArray(row.featuredCourseSlugs).length ? stringArray(row.featuredCourseSlugs) : base.featuredCourseSlugs,
    featuredStrategySlugs: stringArray(row.featuredStrategySlugs).length ? stringArray(row.featuredStrategySlugs) : base.featuredStrategySlugs,
    conversion: {
      journeyHref: typeof conversion.journeyHref === "string" ? conversion.journeyHref : base.conversion.journeyHref,
      journeyLabel: typeof conversion.journeyLabel === "string" ? conversion.journeyLabel : base.conversion.journeyLabel,
      academyHref: typeof conversion.academyHref === "string" ? conversion.academyHref : base.conversion.academyHref,
      academyLabel: typeof conversion.academyLabel === "string" ? conversion.academyLabel : base.conversion.academyLabel,
      loginHref: typeof conversion.loginHref === "string" ? conversion.loginHref : base.conversion.loginHref,
      loginLabel: typeof conversion.loginLabel === "string" ? conversion.loginLabel : base.conversion.loginLabel,
    },
    about: {
      founderName: typeof about.founderName === "string" ? about.founderName : base.about.founderName,
      founderRole: typeof about.founderRole === "string" ? about.founderRole : base.about.founderRole,
      founderDescription: typeof about.founderDescription === "string" ? about.founderDescription : base.about.founderDescription,
      experienceYears: typeof about.experienceYears === "string" ? about.experienceYears : base.about.experienceYears,
      heroTitle: typeof about.heroTitle === "string" ? about.heroTitle : base.about.heroTitle,
      heroDescription: typeof about.heroDescription === "string" ? about.heroDescription : base.about.heroDescription,
    },
    membership: {
      checkoutTitle: typeof membership.checkoutTitle === "string" ? membership.checkoutTitle : base.membership.checkoutTitle,
      checkoutDescription: typeof membership.checkoutDescription === "string" ? membership.checkoutDescription : base.membership.checkoutDescription,
      privacyTitle: typeof membership.privacyTitle === "string" ? membership.privacyTitle : base.membership.privacyTitle,
      privacyDescription: typeof membership.privacyDescription === "string" ? membership.privacyDescription : base.membership.privacyDescription,
      finalTitle: typeof membership.finalTitle === "string" ? membership.finalTitle : base.membership.finalTitle,
      finalHighlight: typeof membership.finalHighlight === "string" ? membership.finalHighlight : base.membership.finalHighlight,
    },
    auth: {
      brandTitle: typeof auth.brandTitle === "string" ? auth.brandTitle : base.auth.brandTitle,
      brandDescription: typeof auth.brandDescription === "string" ? auth.brandDescription : base.auth.brandDescription,
      trustTitle: typeof auth.trustTitle === "string" ? auth.trustTitle : base.auth.trustTitle,
      trustDescription: typeof auth.trustDescription === "string" ? auth.trustDescription : base.auth.trustDescription,
      loginTitle: typeof auth.loginTitle === "string" ? auth.loginTitle : base.auth.loginTitle,
      loginDescription: typeof auth.loginDescription === "string" ? auth.loginDescription : base.auth.loginDescription,
    },
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : base.updatedAt,
  };
}

function mergeMembershipProducts(
  plans: PublicMembershipPlan[],
  rows: Array<Record<string, unknown>>,
): PublicMembershipPlan[] {
  return plans.map((plan) => {
    const match = rows.find((row) => {
      const settings = objectValue(row.settings);
      return row.slug === plan.id || settings.publicPlanId === plan.id || settings.public_plan_id === plan.id;
    });
    if (!match) return plan;
    return {
      ...plan,
      productId: typeof match.id === "string" ? match.id : plan.productId,
      price: typeof match.price === "number" ? match.price : Number(match.price ?? plan.price),
      period: match.billing_interval === "year" ? "năm" : "tháng",
      checkoutEnabled: true,
    };
  });
}

export async function loadPublicAcademyV5(): Promise<PublicAcademyViewModel> {
  const fallback = buildFallbackPublicAcademyViewModel();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return fallback;

  try {
    const [configResult, productsResult] = await Promise.all([
      supabase
        .from("public_academy_configs")
        .select("payload,updated_at")
        .eq("slug", "academy-v5")
        .eq("status", "published")
        .maybeSingle(),
      supabase
        .from("products")
        .select("id,slug,price,billing_interval,settings")
        .eq("product_type", "membership")
        .eq("status", "active"),
    ]);

    const config = configResult.data?.payload
      ? mergeConfig(fallback.config, {
          ...(configResult.data.payload as Record<string, unknown>),
          updatedAt: configResult.data.updated_at,
        })
      : fallback.config;

    const membershipPlans = !productsResult.error && Array.isArray(productsResult.data)
      ? mergeMembershipProducts(fallback.membershipPlans, productsResult.data as Array<Record<string, unknown>>)
      : fallback.membershipPlans;

    // Stages come from career_stages once the admin panel has been used; until then the shipped
    // five stand in, so the public page never goes blank waiting on configuration.
    const organizationId = await configuredAcademyOrganizationId();
    const stages = organizationId ? await loadCareerStages(organizationId) : [];
    const learningPaths = stages.length > 0
      ? stages.map((stage, index) => ({
          id: stage.slug,
          index: stage.indexLabel || String(index + 1).padStart(2, "0"),
          duration: stage.durationLabel,
          title: stage.title,
          description: stage.description,
          skills: stage.skills,
          recommendationHref: `/academy/learning-paths/${stage.slug}`,
          active: index === 1,
        }))
      : fallback.learningPaths;

    return {
      ...fallback,
      config,
      membershipPlans,
      learningPaths,
      source: configResult.data?.payload || productsResult.data?.length || stages.length ? "supabase" : "fallback",
    };
  } catch {
    return fallback;
  }
}
