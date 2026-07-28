import fs from "node:fs";
import path from "node:path";

const phase = Number(process.argv[2] ?? 1);
const names = {
  1: "01-INPUT-GATEWAY.md",
  2: "02-WORD-IMPORT-2.0.md",
  3: "03-PDF-DUAL-IMPORT.md",
  4: "04-IMAGE-SMART-IMPORT.md",
  5: "05-HTML-IMPORT-2.0.md",
  6: "06-ORCHESTRATOR-INTEGRATION.md",
  7: "07-PRODUCTION-HARDENING.md",
};
const name = names[phase];
if (!name) {
  console.error("Usage: pnpm guide:input -- <phase 1-7>");
  process.exit(1);
}
const file = path.join(process.cwd(), "docs/claude-code/phases", name);
console.log(fs.readFileSync(file, "utf8"));
