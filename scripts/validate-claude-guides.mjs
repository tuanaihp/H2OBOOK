import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "CLAUDE.md",
  "docs/claude-code/README.md",
  "docs/claude-code/00-MASTER-EXECUTION-PLAN.md",
  "docs/claude-code/CURRENT-PHASE.md",
  "docs/claude-code/input-roadmap.yaml",
  "docs/claude-code/07-TEST-ACCEPTANCE-MATRIX.md",
  "docs/claude-code/08-DEBUGGING-RUNBOOK.md",
  "docs/claude-code/09-ERROR-CATALOG.md",
  "docs/claude-code/progress/REPORT-TEMPLATE.md",
  ".claude/commands/input-status.md",
  ".claude/commands/input-phase.md",
  ".claude/commands/fix-input-error.md",
  ".claude/commands/validate-input.md",
  "tests/fixtures/input/README.md",
  ...Array.from({ length: 7 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    const names = [
      "INPUT-GATEWAY",
      "WORD-IMPORT-2.0",
      "PDF-DUAL-IMPORT",
      "IMAGE-SMART-IMPORT",
      "HTML-IMPORT-2.0",
      "ORCHESTRATOR-INTEGRATION",
      "PRODUCTION-HARDENING",
    ];
    return `docs/claude-code/phases/${number}-${names[index]}.md`;
  }),
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing Claude guidance files:\n" + missing.map((file) => `- ${file}`).join("\n"));
  process.exit(1);
}

const claude = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8");
const roadmap = fs.readFileSync(path.join(root, "docs/claude-code/input-roadmap.yaml"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const invariants = [
  "No-AI-first",
  "Do not break old projects",
  "assetId",
  "Input Gateway",
  "docs/claude-code/CURRENT-PHASE.md",
];
const absent = invariants.filter((token) => !claude.includes(token));
if (absent.length) {
  console.error("CLAUDE.md is missing mandatory invariants: " + absent.join(", "));
  process.exit(1);
}
for (let phase = 0; phase <= 7; phase += 1) {
  if (!roadmap.includes(`id: ${phase}`)) {
    console.error(`input-roadmap.yaml is missing phase ${phase}`);
    process.exit(1);
  }
}
if (!packageJson.scripts?.["audit:input"] || !packageJson.scripts?.["validate:claude-guides"]) {
  console.error("package.json is missing Claude/input guidance scripts.");
  process.exit(1);
}
console.log(`Claude guidance validation passed (${required.length} required files).`);
