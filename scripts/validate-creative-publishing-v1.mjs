import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const required = [
  "lib/creative-publishing-v1/types.ts",
  "lib/creative-publishing-v1/registry.ts",
  "lib/creative-publishing-v1/feature.ts",
  "lib/creative-publishing-v1/events.ts",
  "lib/creative-publishing-v1/bulk.ts",
  "lib/creative-publishing-v1/editor-handoff.ts",
  "components/creative-publishing-v1/creative-shared.tsx",
  "components/creative-publishing-v1/creative-publishing-preview.tsx",
  "components/creative-publishing-v1/editor-creative-handoff-bridge.tsx",
  "components/creative-publishing-v1/creative-publishing-v1.module.css",
  "app/creative-publishing-v1-preview/[surface]/page.tsx",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing Creative Publishing V1 files:\n" + missing.join("\n"));
  process.exit(1);
}

const registry = fs.readFileSync(path.join(root, "lib/creative-publishing-v1/registry.ts"), "utf8");
const expected = ["assets", "ingestion", "blocks", "books", "brand-kit", "templates", "design-library", "clones", "bulk-publishing", "editor", "content-health", "publish"];
for (const surface of expected) {
  if (!registry.includes(`id: "${surface}"`)) {
    console.error(`Registry is missing surface: ${surface}`);
    process.exit(1);
  }
}

const stages = [...registry.matchAll(/stage:\s*(\d+)/g)].map((match) => Number(match[1]));
if (stages.length !== 12 || new Set(stages).size !== 12 || Math.min(...stages) !== 1 || Math.max(...stages) !== 12) {
  console.error(`Creative pipeline stages are invalid: ${stages.join(", ")}`);
  process.exit(1);
}

const preview = fs.readFileSync(path.join(root, "components/creative-publishing-v1/creative-publishing-preview.tsx"), "utf8");
for (const surface of expected) {
  const token = surface.includes("-") ? `"${surface}":` : `${surface}:`;
  if (!preview.includes(token)) {
    console.error(`Preview switch is missing surface: ${surface}`);
    process.exit(1);
  }
}

console.log("Creative Publishing Operations V1 validation passed.");
console.log(`- ${required.length} required core files`);
console.log(`- ${expected.length} unified surfaces`);
console.log("- 12 ordered pipeline stages");
