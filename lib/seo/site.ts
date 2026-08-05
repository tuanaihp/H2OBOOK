/**
 * The canonical public origin, for robots.txt, the sitemap and any absolute URL that has to survive
 * being read outside the browser. NEXT_PUBLIC_APP_URL is already set in this project's env; the
 * literal is the last resort so a missing variable produces a wrong-but-valid sitemap rather than
 * "undefined/sitemap.xml".
 */
export function publicSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = configured || (fromVercel ? `https://${fromVercel}` : "") || "https://h2obook-app.vercel.app";
  return raw.replace(/\/+$/, "");
}
