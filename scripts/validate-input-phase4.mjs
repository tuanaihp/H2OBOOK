import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { loadTypeScript } from "./lib/load-typescript.mjs";
const ts = await loadTypeScript();

const root = process.cwd();
const required = [
  "packages/input-core/src/image.ts",
  "lib/input/image-import.ts",
  "components/editor/image-smart-import.tsx",
  "app/api/input/image/regions/route.ts",
  "app/api/input/image/materialize-variant/route.ts",
  "supabase/migrations/0020_h2obook_v4134_image_smart_import.sql",
  "tests/unit/image-import.test.ts",
  "tests/fixtures/input/generate-image-fixtures.py",
  "docs/claude-code/progress/PHASE-04-REPORT.md",
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing Phase 4 file: ${file}`);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const core = read("packages/input-core/src/image.ts");
const client = read("lib/input/image-import.ts");
const ui = read("components/editor/image-smart-import.tsx");
const editor = read("components/editor/editor-workspace.tsx");
const uploads = read("lib/security/uploads.ts");
const complete = read("app/api/storage/complete/route.ts");
const preflight = read("lib/editor/preflight.ts");
const processor = read("services/document-processor/app/processors.py");
const migration = read("supabase/migrations/0020_h2obook_v4134_image_smart_import.sql");

for (const token of ["parseImageMetadata", "sha256Hex", "ImageRegion", "imageMetadataWarnings", "workerImageOcrToImportDocument"]) if (!core.includes(token)) throw new Error(`Image core missing: ${token}`);
for (const token of ["inspectImage", "uploadInspectedImage", "buildFullPageImage", "runImageOcr", "cropImageRegion", "generateThumbnailVariant"]) if (!client.includes(token)) throw new Error(`Image client missing: ${token}`);
for (const token of ["Thêm như hình ảnh", "Dùng làm toàn trang", "OCR lấy nội dung", "Tách vùng thủ công", "image-region-stage"]) if (!ui.includes(token)) throw new Error(`Image UI contract missing: ${token}`);
if (!editor.includes("ImageSmartImport") || !editor.includes(".jpe")) throw new Error("Editor is not connected to Image Smart Import/JPE input");
if (!uploads.includes('["jpg", "jpeg", "jpe"]') || !uploads.includes("validateMagicBytes")) throw new Error("JPE or magic-byte validation missing");
if (!complete.includes("readStoredObjectPrefix") || !complete.includes("validateMagicBytes")) throw new Error("Upload completion does not verify stored magic bytes");
for (const token of ["effective_dpi", "image_upscale", "color_profile"]) if (!preflight.includes(token)) throw new Error(`Image preflight missing: ${token}`);
for (const token of ["ImageOps.exif_transpose", "requested_regions", "regionOrder", "pytesseract.image_to_data"]) if (!processor.includes(token)) throw new Error(`Image OCR worker missing: ${token}`);
for (const token of ["asset_variants", "image_import_regions", "replace_image_import_regions", "enable row level security"]) if (!migration.includes(token)) throw new Error(`Phase 4 migration missing: ${token}`);

const compile = spawnSync("python", ["-m", "py_compile", path.join(root, "services/document-processor/app/processors.py")], { encoding: "utf8" });
if (compile.status !== 0) throw new Error(`Python image worker compile failed: ${compile.stderr}`);
const fixture = spawnSync("python", [path.join(root, "tests/fixtures/input/generate-image-fixtures.py")], { encoding: "utf8" });
if (fixture.status !== 0) throw new Error(`Image fixture generation failed: ${fixture.stderr}`);
const ocr = spawnSync("python", ["-c", `from PIL import Image\nimport pytesseract\nimg=Image.open(r'${path.join(root, "tests/fixtures/input/image-ocr.png")}')\nr=pytesseract.image_to_data(img,lang='eng',output_type=pytesseract.Output.DICT)\ntext=' '.join(x for x in r['text'] if str(x).strip())\nnormalized=''.join(ch for ch in text.upper().replace('0','O') if ch.isalnum())\nassert 'H2OBOOK' in normalized and 'IMAGESMARTIMPORT' in normalized, text\nprint(text)`], { encoding: "utf8" });
if (ocr.status !== 0) throw new Error(`Tesseract image runtime failed: ${ocr.stderr || ocr.stdout}`);

const source = core.replace(/^import type[\s\S]*?;\n/gm, "");
const transpiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const temp = path.join(root, ".phase4-runtime-check.mjs");
fs.writeFileSync(temp, transpiled);
try {
  const module = await import(`${pathToFileURL(temp).href}?v=${Date.now()}`);
  const fixtureBytes = fs.readFileSync(path.join(root, "tests/fixtures/input/image-transparent.png"));
  const fixtureBuffer = fixtureBytes.buffer.slice(fixtureBytes.byteOffset, fixtureBytes.byteOffset + fixtureBytes.byteLength);
  const metadata = module.parseImageMetadata(fixtureBuffer,{fileName:"image-transparent.png",mimeType:"image/png",sizeBytes:fixtureBytes.length});
  if (metadata.pixelWidth !== 640 || metadata.pixelHeight !== 420 || !metadata.hasAlpha || Math.round(metadata.dpiX) !== 300) {
    throw new Error(`PNG metadata runtime failed: ${JSON.stringify(metadata)}`);
  }
  const jpegBytes = fs.readFileSync(path.join(root, "tests/fixtures/input/image-exif-rotation.jpe"));
  const jpegBuffer = jpegBytes.buffer.slice(jpegBytes.byteOffset, jpegBytes.byteOffset + jpegBytes.byteLength);
  const jpeg = module.parseImageMetadata(jpegBuffer,{fileName:"image-exif-rotation.jpe",mimeType:"image/jpeg",sizeBytes:jpegBytes.length});
  if (jpeg.pixelWidth !== 1200 || jpeg.pixelHeight !== 800 || jpeg.orientation !== 6 || Math.round(jpeg.dpiX) !== 300) {
    throw new Error(`JPE metadata runtime failed: ${JSON.stringify(jpeg)}`);
  }
  const corruptBytes = fs.readFileSync(path.join(root, "tests/fixtures/input/image-corrupt.jpe"));
  const corruptBuffer = corruptBytes.buffer.slice(corruptBytes.byteOffset, corruptBytes.byteOffset + corruptBytes.byteLength);
  let corruptRejected = false;
  try { module.parseImageMetadata(corruptBuffer,{fileName:"image-corrupt.jpe",mimeType:"image/jpeg",sizeBytes:corruptBytes.length}); }
  catch { corruptRejected = true; }
  if (!corruptRejected) throw new Error("MIME-confused JPE fixture was not rejected");
} finally { fs.rmSync(temp,{force:true}); }

console.log(`H2OBOOK 4.13 Phase 4 validation passed: ${required.length} required files, four image modes, JPE/magic validation, metadata, region OCR, variants and DPI preflight.`);
