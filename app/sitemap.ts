import type { MetadataRoute } from "next";
import { publicBooks, publicCourses, publicStrategies, learningPaths } from "@/lib/public-site/content";
import { listPublicStageSlugs } from "@/lib/career-stages/public";
import { publicSiteUrl } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

// Only pages a signed-out visitor can actually open. Everything behind auth is excluded here and
// again in robots.ts — listing a route that answers 307 to /login is worse than omitting it, since
// it spends crawl budget to discover a redirect.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl();
  const now = new Date();

  const staticPages = [
    { path: "", priority: 1 },
    { path: "/academy/books", priority: 0.9 },
    { path: "/academy/courses", priority: 0.9 },
    { path: "/academy/strategies", priority: 0.8 },
    { path: "/academy/learning-paths", priority: 0.8 },
    { path: "/academy/membership", priority: 0.8 },
    { path: "/academy/about", priority: 0.5 },
    { path: "/academy/success-stories", priority: 0.5 }
  ];

  // Career stages come from the database once configured, so a stage added in the admin panel
  // appears here without a deploy; the shipped five stand in until then.
  const stageSlugs = await listPublicStageSlugs().catch(() => learningPaths.map((path) => path.id));

  return [
    ...staticPages.map(({ path, priority }) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: "weekly" as const, priority })),
    ...publicBooks.map((book) => ({ url: `${base}/academy/books/${book.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...publicCourses.map((course) => ({ url: `${base}/academy/courses/${course.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...publicStrategies.map((strategy) => ({ url: `${base}/academy/strategies/${strategy.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...stageSlugs.map((slug) => ({ url: `${base}/academy/learning-paths/${slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 }))
  ];
}
