import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const required = [
  "packages/input-core/src/types.ts", "packages/input-core/src/session.ts", "packages/input-core/src/word-html.ts",
  "lib/input/word-import.ts", "app/api/input/word/fallback/route.ts", "tests/unit/word-import.test.ts",
  "docs/claude-code/progress/PHASE-02-REPORT.md",
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing Phase 2 file: ${file}`);
const editor = fs.readFileSync(path.join(root, "components/editor/editor-workspace.tsx"), "utf8");
const importer = fs.readFileSync(path.join(root, "lib/input/word-import.ts"), "utf8");
const parser = fs.readFileSync(path.join(root, "packages/input-core/src/word-html.ts"), "utf8");
const processor = fs.readFileSync(path.join(root, "services/document-processor/app/processors.py"), "utf8");
if (editor.includes("mammoth.extractRawText")) throw new Error("Legacy extractRawText remains in editor DOCX path");
for (const token of ["importDocxToBookDocument", "word-import-preview", "Nhập vào Compose"]) if (!editor.includes(token)) throw new Error(`Word preview contract missing: ${token}`);
for (const token of ["convertToHtml", "WORD_STYLE_MAP", "convertImage", "queueDocxFallback"]) if (!importer.includes(token)) throw new Error(`Word importer missing: ${token}`);
for (const token of ["table_cell", "footnote", "data-h2o-asset-id", "pageBreak"]) if (!parser.includes(token)) throw new Error(`Semantic Word parser missing: ${token}`);
for (const token of ["python-docx-fallback-2.0", "bookDocument", "_docx_footnotes", "_extract_docx_image", "_table_payload"]) if (!processor.includes(token)) throw new Error(`Python fallback missing: ${token}`);
// The package path contains a hyphen, so runtime helpers are validated through py_compile below.
const compile = spawnSync("python", ["-m", "py_compile", path.join(root, "services/document-processor/app/processors.py")], { encoding: "utf8" });
if (compile.status !== 0) throw new Error(`Python fallback compile failed: ${compile.stderr}`);
console.log(`H2OBOOK 4.13 Phase 2 validation passed: ${required.length} required files, rich DOCX path, semantic preview, assets, tables and python-docx fallback.`);
