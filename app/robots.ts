import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/seo/site";

// Disallow is the interesting half. Everything under these prefixes is either behind auth, a
// per-user surface, or an internal tool — crawling them wastes budget and, for the operator
// consoles, publishes the shape of the admin surface to anyone reading robots.txt. The auth pages
// are excluded because a sign-in form is not a search result anyone wants.
const DISALLOW = [
  "/api/", "/student/", "/dashboard", "/admin", "/platform-admin", "/academy-admin", "/operations",
  "/instructor", "/editor", "/input", "/publish", "/library", "/books", "/orders", "/store",
  "/templates", "/design-library", "/settings", "/smart-settings", "/security", "/enterprise",
  "/integrations", "/cloud-sync", "/offline", "/assist-control", "/dev/",
  "/login", "/signup", "/forgot-password", "/reset-password", "/auth/", "/unauthorized"
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: DISALLOW }],
    sitemap: `${publicSiteUrl()}/sitemap.xml`,
    host: publicSiteUrl()
  };
}
