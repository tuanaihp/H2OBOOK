import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routes = [
  "dashboard", "learn", "knowledge", "library", "assignments", "classes", "quizzes", "study",
  "class-view", "students", "reviews", "collaboration", "automations", "processing"
];
const components = [
  "dashboard", "learn", "knowledge", "library", "assignments", "classes", "quizzes", "study",
  "class-view", "students", "reviews", "collaboration", "automations", "processing", "shared"
];
const required = [
  "components/academic-ops-v2/index.ts",
  "components/academic-ops-v2/academic-ops.module.css",
  ...components.map((name) => `components/academic-ops-v2/${name}.tsx`),
  "lib/academic-ops-v2/types.ts",
  "lib/academic-ops-v2/selectors.ts",
  "lib/academic-ops-v2/teaching-data.ts",
  "lib/academic-ops-v2/feature.ts",
  "lib/academic-ops-v2/analytics.ts",
  ...routes.map((route) => `app/academic-ops-v2-preview/${route}/page.tsx`)
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Academic Operations V2 missing files:\n" + missing.join("\n"));
  process.exit(1);
}

const indexSource = fs.readFileSync(path.join(root, "components/academic-ops-v2/index.ts"), "utf8");
for (const name of ["automations", "class-view", "collaboration", "processing", "reviews", "students"]) {
  if (!indexSource.includes(`./${name}`)) {
    console.error(`Missing export for ${name}`);
    process.exit(1);
  }
}

const envFile = [".env.example.fragment", ".env.example"].map((file) => path.join(root, file)).find((file) => fs.existsSync(file));
if (!envFile) { console.error("Missing env example file"); process.exit(1); }
const envSource = fs.readFileSync(envFile, "utf8");
if (!envSource.includes("NEXT_PUBLIC_ACADEMIC_OPERATIONS_V2")) { console.error("Missing NEXT_PUBLIC_ACADEMIC_OPERATIONS_V2 flag"); process.exit(1); }

console.log(`Academic Operations V2 validation passed: ${required.length} files, ${routes.length} preview routes.`);
