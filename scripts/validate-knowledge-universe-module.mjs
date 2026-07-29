import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "components/knowledge-universe/knowledge-universe-hero.tsx",
  "components/knowledge-universe/knowledge-universe-hero.module.css",
  "components/knowledge-universe/index.ts",
  "lib/knowledge-universe/data.ts",
  "lib/knowledge-universe/types.ts",
  "lib/knowledge-universe/feature.ts",
  "app/academy/knowledge-universe/page.tsx",
  "tests/unit/knowledge-universe.test.ts",
  "tests/e2e/knowledge-universe.spec.ts",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing Knowledge Universe files:\n" + missing.join("\n"));
  process.exit(1);
}

const data = fs.readFileSync(path.join(root, "lib/knowledge-universe/data.ts"), "utf8");
const component = fs.readFileSync(path.join(root, "components/knowledge-universe/knowledge-universe-hero.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "components/knowledge-universe/knowledge-universe-hero.module.css"), "utf8");

const checks = [
  ["10 knowledge planets", (data.match(/id: "/g) ?? []).length >= 14],
  ["3 orbit levels", ["orbit: 1", "orbit: 2", "orbit: 3"].every((token) => data.includes(token))],
  ["brain processing stages", ["ingest", "connect", "personalize", "act"].every((token) => data.includes(token))],
  ["accessible motion control", component.includes("aria-pressed") && component.includes("Tạm dừng chuyển động")],
  ["public/student/workspace access", ["public", "student", "workspace"].every((token) => data.includes(`access: \"${token}\"`))],
  ["reduced motion", css.includes("prefers-reduced-motion")],
  ["mobile planet fallback", component.includes("mobilePlanetRail") && css.includes(".mobilePlanetRail")],
  ["feature flag helper", fs.readFileSync(path.join(root, "lib/knowledge-universe/feature.ts"), "utf8").includes("NEXT_PUBLIC_KNOWLEDGE_UNIVERSE_HERO_V1")],
];

for (const [label, passed] of checks) {
  if (!passed) {
    console.error(`FAILED: ${label}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}
console.log(`Knowledge Universe module validated: ${required.length} required files, ${checks.length} architecture checks.`);
