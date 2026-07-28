import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"];
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "__pycache__"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) files.push(target);
  }
}
walk(root);
function exists(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return true;
  return extensions.some(extension => fs.existsSync(base + extension)) || extensions.some(extension => fs.existsSync(path.join(base, `index${extension}`)));
}
const failures = [];
const pattern = /(?:from\s+|import\s*\()(["'])([^"']+)\1/g;
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(pattern)) {
    const source = match[2];
    if (!(source.startsWith("@/") || source.startsWith("./") || source.startsWith("../"))) continue;
    const target = source.startsWith("@/") ? path.join(root, source.slice(2)) : path.resolve(path.dirname(file), source);
    if (!exists(target)) failures.push(`${path.relative(root, file)} -> ${source}`);
  }
}
if (failures.length) {
  console.error(`Unresolved local imports (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Local import validation passed: ${files.length} source files.`);
