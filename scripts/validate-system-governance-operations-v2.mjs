import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const components = path.join(root, "components/system-governance-ops-v2");
const lib = path.join(root, "lib/system-governance-ops-v2");
const required = [
  "components/system-governance-ops-v2/system-governance-preview.tsx",
  "components/system-governance-ops-v2/system-shared.tsx",
  "components/system-governance-ops-v2/operations-shared.tsx",
  "components/system-governance-ops-v2/system-governance-ops-v2.module.css",
  "lib/system-governance-ops-v2/types.ts",
  "lib/system-governance-ops-v2/registry.ts",
  "lib/system-governance-ops-v2/data.ts",
  "lib/system-governance-ops-v2/events.ts",
  "lib/system-governance-ops-v2/feature.ts",
  "app/system-governance-ops-v2-preview/[surface]/page.tsx",
];
const surfaces = [
  "account", "admin", "assist-control", "cloud-sync", "enterprise", "integrations", "offline", "security", "settings", "smart-settings",
  "operations", "operations-admissions", "operations-approvals", "operations-automation-center", "operations-import-center", "operations-notifications", "operations-product-config", "operations-support", "operations-system-health",
];
const pageFiles = [
  "account-v2.tsx", "admin-v2.tsx", "assist-control-v2.tsx", "cloud-sync-v2.tsx", "enterprise-v2.tsx", "integrations-v2.tsx", "offline-v2.tsx", "security-v2.tsx", "settings-v2.tsx", "smart-settings-v2.tsx",
  "operations-v2.tsx", "operations-admissions-v2.tsx", "operations-approvals-v2.tsx", "operations-automation-center-v2.tsx", "operations-import-center-v2.tsx", "operations-notifications-v2.tsx", "operations-product-config-v2.tsx", "operations-support-v2.tsx", "operations-system-health-v2.tsx",
];

const missing = [...required, ...pageFiles.map((file) => `components/system-governance-ops-v2/pages/${file}`)]
  .filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing required files:\n" + missing.join("\n"));
  process.exit(1);
}

const preview = fs.readFileSync(path.join(components, "system-governance-preview.tsx"), "utf8");
const registry = fs.readFileSync(path.join(lib, "registry.ts"), "utf8");
const types = fs.readFileSync(path.join(lib, "types.ts"), "utf8");
for (const surface of surfaces) {
  if (!registry.includes(`id: \"${surface}\"`)) throw new Error(`Missing registry surface: ${surface}`);
  if (!types.includes(`| \"${surface}\"`)) throw new Error(`Missing type surface: ${surface}`);
  if (!preview.includes(`\"${surface}\"`) && !preview.includes(`${surface}:`)) throw new Error(`Missing preview mapping: ${surface}`);
}

const oldTokens = [["system", "governance", "v1"].join("-"), ["NEXT_PUBLIC_SYSTEM_GOVERNANCE_INFRA_OPS", "V1"].join("_")];
for (const token of oldTokens) {
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs|md|json|fragment)$/.test(entry.name) && fs.readFileSync(full, "utf8").includes(token)) hits.push(path.relative(root, full));
    }
  };
  walk(root);
  if (hits.length) throw new Error(`Legacy token ${token} found in: ${hits.join(", ")}`);
}

const css = fs.readFileSync(path.join(components, "system-governance-ops-v2.module.css"), "utf8");
let depth = 0;
for (const char of css) {
  if (char === "{") depth += 1;
  if (char === "}") depth -= 1;
  if (depth < 0) throw new Error("CSS contains an unmatched closing brace");
}
if (depth !== 0) throw new Error("CSS braces are not balanced");
if (!css.includes(".kanban") || !css.includes(".healthGrid") || !css.includes(".surfaceNavigator")) throw new Error("Operations V2 CSS contract is incomplete");

console.log(`System Governance & Operations V2 validator passed: ${surfaces.length} surfaces, ${pageFiles.length} pages.`);
