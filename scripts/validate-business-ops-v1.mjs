import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/business-ops-v1-preview/[surface]/page.tsx",
  "components/business-ops-v1/business-ops-preview.tsx",
  "components/business-ops-v1/business-ops-v1.module.css",
  "lib/business-ops-v1/types.ts",
  "lib/business-ops-v1/registry.ts",
  "lib/business-ops-v1/pipeline.ts",
  "lib/business-ops-v1/events.ts",
  "lib/business-ops-v1/feature.ts",
  "lib/business-ops-v1/data.ts",
];
const pages = [
  "analytics-ops-v1",
  "growth-reader-ops-v1",
  "licensing-royalty-v1",
  "marketplace-studio-v1",
  "membership-ops-v1",
  "orders-entitlements-v1",
  "store-commerce-v1",
  "white-label-portals-v1",
];
for (const page of pages) required.push(`components/business-ops-v1/pages/${page}.tsx`);
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing Business Ops V1 files:\n${missing.join("\n")}`);
  process.exit(1);
}
const registry = fs.readFileSync(path.join(root, "lib/business-ops-v1/registry.ts"), "utf8");
for (const surface of ["analytics", "growth-reader", "licensing", "marketplace-studio", "membership", "orders", "store", "white-label"]) {
  if (!registry.includes(`id: "${surface}"`)) {
    console.error(`Registry missing ${surface}`);
    process.exit(1);
  }
}
const css = fs.readFileSync(path.join(root, "components/business-ops-v1/business-ops-v1.module.css"), "utf8");
const opens = (css.match(/{/g) ?? []).length;
const closes = (css.match(/}/g) ?? []).length;
if (opens !== closes) {
  console.error(`CSS braces mismatch: ${opens}/${closes}`);
  process.exit(1);
}
console.log(`Business Ops V1 validated: ${required.length} files, ${pages.length} surfaces, ${opens} CSS blocks.`);
