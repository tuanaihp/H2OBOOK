import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const editor = read("components/editor/editor-workspace.tsx");
const uploads = read("lib/security/uploads.ts");
const parser = read("packages/ingestion-core/src/parser.ts");
const processor = read("services/document-processor/app/processors.py");
const wordImporter = fs.existsSync(path.join(root,"lib/input/word-import.ts")) ? read("lib/input/word-import.ts") : "";
const pdfImporter = fs.existsSync(path.join(root,"lib/input/pdf-import.ts")) ? read("lib/input/pdf-import.ts") : "";
const pdfCore = fs.existsSync(path.join(root,"packages/input-core/src/pdf.ts")) ? read("packages/input-core/src/pdf.ts") : "";
const inputCore = fs.existsSync(path.join(root,"packages/input-core/src/session.ts")) ? read("packages/input-core/src/session.ts") : "";
const imageImporter = fs.existsSync(path.join(root,"lib/input/image-import.ts")) ? read("lib/input/image-import.ts") : "";
const imageCore = fs.existsSync(path.join(root,"packages/input-core/src/image.ts")) ? read("packages/input-core/src/image.ts") : "";
const imageUi = fs.existsSync(path.join(root,"components/editor/image-smart-import.tsx")) ? read("components/editor/image-smart-import.tsx") : "";
const jobs = read("lib/queue/document-queue.ts");
const htmlServer = fs.existsSync(path.join(root,"lib/input/html-import.server.ts")) ? read("lib/input/html-import.server.ts") : "";
const htmlClient = fs.existsSync(path.join(root,"lib/input/html-import.ts")) ? read("lib/input/html-import.ts") : "";

const orchestratorCore = fs.existsSync(path.join(root,"packages/input-core/src/orchestrator.ts")) ? read("packages/input-core/src/orchestrator.ts") : "";
const orchestratorServer = fs.existsSync(path.join(root,"lib/input/orchestrator-server.ts")) ? read("lib/input/orchestrator-server.ts") : "";
const orchestratorUi = fs.existsSync(path.join(root,"components/input/unified-input-gateway.tsx")) ? read("components/input/unified-input-gateway.tsx") : "";
const orchestratorMigration = fs.existsSync(path.join(root,"supabase/migrations/0021_h2obook_v4136_input_orchestrator.sql")) ? read("supabase/migrations/0021_h2obook_v4136_input_orchestrator.sql") : "";

const checks = [
  { capability: "Shared InputSession contract", state: inputCore.includes("InputSession") && inputCore.includes("detectInputFormat") ? "yes" : "no", evidence: "packages/input-core/src/session.ts" },
  {
    capability: "DOCX accepted in editor",
    state: editor.includes(".docx") ? "yes" : "no",
    evidence: "components/editor/editor-workspace.tsx",
  },
  {
    capability: "DOCX rich import replaces raw-text final path",
    state: editor.includes("mammoth.extractRawText") ? "partial/raw-text" : wordImporter.includes("convertToHtml") && wordImporter.includes("WORD_STYLE_MAP") ? "yes" : "unknown",
    evidence: "components/editor/editor-workspace.tsx",
  },
  {
    capability: "PDF.js fixed-layout import",
    state: pdfImporter.includes('import("pdfjs-dist")') && pdfImporter.includes("renderPdfFixedLayout") && pdfImporter.includes("canvas.toBlob") ? "yes" : "no",
    evidence: "components/editor/editor-workspace.tsx",
  },
  {
    capability: "PDF Dual Import mode selection",
    state: editor.includes("PDF DUAL IMPORT") && editor.includes("OCR PDF scan") ? "yes" : "no",
    evidence: "components/editor/editor-workspace.tsx",
  },
  {
    capability: "PDF editable semantic reconstruction",
    state: pdfImporter.includes("reconstructPdfInBrowser") && pdfCore.includes("pdfPagesToImportDocument") && processor.includes("def pdf_reconstruct") ? "yes" : "partial",
    evidence: "lib/input/pdf-import.ts + packages/input-core/src/pdf.ts + Python worker",
  },
  {
    capability: "PDF OCR layout reconstruction",
    state: processor.includes("pytesseract.image_to_data") && processor.includes("ocrConfidence") ? "yes" : "partial",
    evidence: "services/document-processor/app/processors.py",
  },
  {
    capability: "Python PDF worker",
    state: processor.includes("def pdf_import") ? "yes" : "no",
    evidence: "services/document-processor/app/processors.py",
  },
  {
    capability: "Python DOCX worker",
    state: processor.includes("def docx_import") ? "yes" : "no",
    evidence: "services/document-processor/app/processors.py",
  },
  {
    capability: "OCR worker",
    state: processor.includes("def ocr") && processor.includes("vie") ? "yes" : "partial",
    evidence: "services/document-processor/app/processors.py",
  },
  {
    capability: "JPE extension",
    state: uploads.includes('"jpe"') && editor.includes(".jpe") ? "yes" : "no",
    evidence: "lib/security/uploads.ts + editor accept",
  },
  {
    capability: "Image Smart Import four modes",
    state: ["Thêm như hình ảnh", "Dùng làm toàn trang", "OCR lấy nội dung", "Tách vùng thủ công"].every((token) => imageUi.includes(token)) ? "yes" : "partial",
    evidence: "components/editor/image-smart-import.tsx",
  },
  {
    capability: "Image metadata/EXIF/DPI inspection",
    state: imageCore.includes("parseImageMetadata") && imageCore.includes("parseExif") && imageCore.includes("dpiX") ? "yes" : "partial",
    evidence: "packages/input-core/src/image.ts",
  },
  {
    capability: "Image OCR and manual regions",
    state: imageImporter.includes("runImageOcr") && imageImporter.includes("cropImageRegion") && processor.includes("requested_regions") ? "yes" : "partial",
    evidence: "lib/input/image-import.ts + Python worker",
  },
  {
    capability: "Stored-object magic byte validation",
    state: uploads.includes("validateMagicBytes") ? "yes" : "no",
    evidence: "lib/security/uploads.ts + storage complete API",
  },
  {
    capability: "HTML/HTM direct upload",
    state: editor.includes(".html") && editor.includes(".htm") && uploads.includes("text/html") ? "yes" : "no",
    evidence: "editor accept + lib/security/uploads.ts",
  },
  {
    capability: "HTML semantic parser",
    state: htmlServer.includes('from "jsdom"') && htmlServer.includes("parseHtmlImport") ? "yes" : parser.includes("parseHtml") ? "partial/regex" : "no",
    evidence: "lib/input/html-import.server.ts",
  },
  {
    capability: "HTML sanitization and controlled embeds",
    state: htmlServer.includes("sanitizeDocument") && htmlServer.includes("SAFE_EMBED_HOSTS") ? "yes" : "no",
    evidence: "lib/input/html-import.server.ts",
  },
  {
    capability: "HTML remote asset localization",
    state: htmlClient.includes("localizeHtmlAssets") && htmlClient.includes("/api/input/html/fetch-asset") ? "yes" : "no",
    evidence: "lib/input/html-import.ts + HTML asset proxy",
  },
  { capability: "Unified Input Orchestrator state machine", state: orchestratorCore.includes("transitionInputSession") && orchestratorCore.includes("inputFingerprint") ? "yes" : "no", evidence: "packages/input-core/src/orchestrator.ts" },
  { capability: "Unified session API and recovery", state: orchestratorServer.includes("createInputSession") && orchestratorServer.includes("retryInputSession") && orchestratorServer.includes("commitInputSession") ? "yes" : "no", evidence: "lib/input/orchestrator-server.ts + app/api/input/sessions" },
  { capability: "One gateway UI for all formats", state: ["DOCX", "PDF", "Image", "HTML", "Markdown", "TXT", "URL"].every((token) => orchestratorUi.includes(token)) ? "yes" : "partial", evidence: "components/input/unified-input-gateway.tsx" },
  { capability: "Atomic idempotent input commit", state: orchestratorMigration.includes("commit_input_session") && orchestratorMigration.includes("idempotency_key") && orchestratorMigration.includes("recovery_required") ? "yes" : "no", evidence: "0021 input orchestrator migration" },
  {
    capability: "Document queue types",
    state: ["pdf_import", "docx_import", "ocr"].every((token) => jobs.includes(token)) ? "yes" : "partial",
    evidence: "lib/queue/document-queue.ts",
  },
];

console.log("H2OBOOK input capability audit\n");
console.table(checks);
const summary = checks.reduce((acc, check) => {
  acc[check.state] = (acc[check.state] ?? 0) + 1;
  return acc;
}, {});
console.log("Summary:", summary);
console.log("\nThis audit reports code signals only. It does not prove end-to-end production operation.");
