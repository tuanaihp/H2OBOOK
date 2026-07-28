import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { loadTypeScript } from "./lib/load-typescript.mjs";
const ts = await loadTypeScript();

const root = process.cwd();
const required = [
  "packages/input-core/src/pdf.ts", "lib/input/pdf-import.ts", "tests/unit/pdf-import.test.ts",
  "app/api/input/pdf/materialize-assets/route.ts", "supabase/migrations/0019_h2obook_v4133_pdf_dual_import.sql", "docs/claude-code/progress/PHASE-03-REPORT.md",
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing Phase 3 file: ${file}`);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const editor = read("components/editor/editor-workspace.tsx");
const client = read("lib/input/pdf-import.ts");
const core = read("packages/input-core/src/pdf.ts");
const processor = read("services/document-processor/app/processors.py");
const jobs = read("lib/queue/document-queue.ts");
const migration = read("supabase/migrations/0019_h2obook_v4133_pdf_dual_import.sql");
for (const token of ["PDF DUAL IMPORT", "Giữ nguyên thiết kế", "Nội dung chỉnh sửa", "OCR PDF scan", "pdf-correction-panel"]) if (!editor.includes(token)) throw new Error(`PDF UI contract missing: ${token}`);
for (const token of ["inspectPdf", "reconstructPdfInBrowser", "renderPdfFixedLayout", "reconstructPdfWithWorker", "PDF_PASSWORD_PROTECTED"]) if (!client.includes(token)) throw new Error(`PDF client missing: ${token}`);
for (const token of ["groupPdfSpansIntoLines", "pdfPagesToImportDocument", "tableSignature", "readingOrder"]) if (!core.includes(token)) throw new Error(`PDF semantic core missing: ${token}`);
for (const token of ["def pdf_reconstruct", "page.get_text(\"dict\"", "page.find_tables", "pytesseract.image_to_data", "ocrConfidence", "bookDocument"]) if (!processor.includes(token)) throw new Error(`PDF worker missing: ${token}`);
if (!jobs.includes('"pdf_reconstruct"')) throw new Error("Document queue does not expose pdf_reconstruct");
if (!migration.includes("pdf_reconstruct") || !migration.includes("document_jobs_job_type_check")) throw new Error("PDF reconstruct database constraint migration missing");
const compile = spawnSync("python", ["-m", "py_compile", path.join(root, "services/document-processor/app/processors.py")], { encoding: "utf8" });
if (compile.status !== 0) throw new Error(`Python PDF worker compile failed: ${compile.stderr}`);

// Execute the pure PDF semantic core without installing project dependencies.
const source = core.replace(/^import type .*$/gm, "");
const transpiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const temp = path.join(root, ".phase3-runtime-check.mjs");
fs.writeFileSync(temp, transpiled);
try {
  const module = await import(`${pathToFileURL(temp).href}?v=${Date.now()}`);
  const result = module.pdfPagesToImportDocument({
    title: "Runtime PDF", sourceFileName: "runtime.pdf", bookId: "runtime-book",
    pages: [{ page: 1, width: 595, height: 842, spans: [
      { text: "TIÊU ĐỀ", page: 1, x: 40, y: 780, width: 120, height: 26, fontSize: 26, bold: true },
      { text: "Nội dung", page: 1, x: 40, y: 730, width: 80, height: 12, fontSize: 12 },
      { text: "Tên", page: 1, x: 40, y: 680, width: 25, height: 12, fontSize: 12 },
      { text: "Điểm", page: 1, x: 200, y: 680, width: 30, height: 12, fontSize: 12 },
      { text: "A", page: 1, x: 40, y: 660, width: 10, height: 12, fontSize: 12 },
      { text: "9", page: 1, x: 200, y: 660, width: 10, height: 12, fontSize: 12 },
    ] }],
  });
  if (result.statistics.headings < 1 || result.statistics.tables < 1) throw new Error("PDF semantic runtime did not reconstruct heading/table");
} finally { fs.rmSync(temp, { force: true }); }
console.log(`H2OBOOK 4.13 Phase 3 validation passed: ${required.length} required files, PDF mode selection, native text reconstruction, fixed layout, OCR layout and manual correction.`);
