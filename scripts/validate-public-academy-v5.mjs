import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "components/public-home-v3/public-home-v3.tsx",
  "components/public-academy-v5/public-academy-pages.tsx",
  "components/public-academy-v5/catalog-client.tsx",
  "components/public-academy-v5/membership-enrollment-client.tsx",
  "components/public-academy-v5/public-login-experience.tsx",
  "components/public-academy-v5/public-academy-v5.module.css",
  "components/public-academy-v5/public-auth-v5.module.css",
  "lib/public-academy-v5/types.ts",
  "lib/public-academy-v5/fallback.ts",
  "lib/public-academy-v5/loader.server.ts",
  "lib/public-academy-v5/feature.ts",
  "app/api/public/membership/lead/route.ts",
  "app/academy/public-suite-v5-preview/page.tsx",
  "app/academy/public-suite-v5-preview/about/page.tsx",
  "app/academy/public-suite-v5-preview/books/page.tsx",
  "app/academy/public-suite-v5-preview/courses/page.tsx",
  "app/academy/public-suite-v5-preview/learning-paths/page.tsx",
  "app/academy/public-suite-v5-preview/strategies/page.tsx",
  "app/academy/public-suite-v5-preview/membership/page.tsx",
  "app/academy/public-suite-v5-preview/login/page.tsx",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing Public Academy V5 files:\n" + missing.join("\n"));
  process.exit(1);
}

const fallback = fs.readFileSync(path.join(root, "lib/public-academy-v5/fallback.ts"), "utf8");
const pages = fs.readFileSync(path.join(root, "components/public-academy-v5/public-academy-pages.tsx"), "utf8");
const login = fs.readFileSync(path.join(root, "components/public-academy-v5/public-login-experience.tsx"), "utf8");
const membership = fs.readFileSync(path.join(root, "components/public-academy-v5/membership-enrollment-client.tsx"), "utf8");
const checks = [
  [fallback.includes("publicBooks.map"), "books normalization"],
  [fallback.includes("publicCourses.map"), "courses normalization"],
  [fallback.includes("publicStrategies.map"), "strategies normalization"],
  [fallback.includes("existingMembershipPlans.map"), "membership normalization"],
  [pages.includes("PublicAcademyMembershipPage"), "membership page"],
  [pages.includes("PublicAcademyLoginPage"), "login page"],
  [pages.includes("PublicAcademyLearningPathsPage"), "learning paths page"],
  [membership.includes("/api/payments/checkout"), "checkout bridge"],
  [membership.includes("/api/public/membership/lead"), "lead bridge"],
  [login.includes("safeNextPath"), "safe next redirect"],
  [login.includes("roleHome"), "role redirect"],
  [login.includes("NEXT_PUBLIC_AUTH_DEMO_LINKS"), "demo link protection"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  console.error("Public Academy V5 checks failed:\n" + failed.map(([, label]) => label).join("\n"));
  process.exit(1);
}

console.log(`Public Academy V5 validation passed: ${required.length} required files, ${checks.length} architecture checks.`);
