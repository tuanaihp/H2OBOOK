import fs from "node:fs";
import path from "node:path";
const roots = ["lib/input", "packages/input-core", "components/input", "components/editor", "store"];
const findings = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const text = fs.readFileSync(full, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, index) => {
        if (/data:image\/[a-z+.-]+;base64/i.test(line) && !/read\("base64"\)/.test(line)) findings.push(`${full}:${index + 1}`);
        if (/(preview_document|BookDocument|book\.)\s*[:=].*base64/i.test(line)) findings.push(`${full}:${index + 1}`);
      });
    }
  }
}
roots.forEach(walk);
if (findings.length) throw new Error(`Base64 persistence regression detected:\n${findings.join("\n")}`);
console.log("Input storage regression check passed: no persistent Base64 image payload detected in input/editor state paths.");
