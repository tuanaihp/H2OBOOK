import fs from "node:fs";
import vm from "node:vm";
import { loadTypeScript } from "./lib/load-typescript.mjs";
const ts = await loadTypeScript();

function load(file, extras = {}) {
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: () => ({}), crypto: globalThis.crypto, TextEncoder, TextDecoder, Uint8Array, process, console, Math, Date, JSON, Set, Map, Error, ...extras }, { filename: file });
  return module.exports;
}

const hardening = load("packages/input-core/src/hardening.ts");
const uploads = load("lib/security/uploads.ts");

const policy = hardening.getInputRuntimePolicy("pdf", "ocr");
if (policy.timeoutMs < 30 * 60_000 || policy.maxAttempts > 3) throw new Error("PDF OCR policy is unsafe");
if (hardening.computeRetryDelayMs(2, { random: 0.5 }) !== 8000) throw new Error("retry backoff is not deterministic at midpoint jitter");
const redacted = hardening.redactInputTelemetry({ content: "private", token: "secret", statistics: { nodes: 5 }, long: "x".repeat(500) });
if (redacted.content !== "[REDACTED]" || redacted.token !== "[REDACTED]" || redacted.statistics.nodes !== 5) throw new Error("telemetry redaction failed");

const node = { id: crypto.randomUUID(), type: "paragraph", parentId: null, position: 0, text: [{ text: "hello" }], attrs: {}, children: [], version: 1 };
const doc = { format: "txt", sourceFileName: "x.txt", title: "x", document: { id: crypto.randomUUID(), bookId: crypto.randomUUID(), title: "x", language: "vi", root: [node], metadata: {}, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, nodes: [node], assets: [], warnings: [], statistics: { nodes: 1, headings: 0, paragraphs: 1, lists: 0, tables: 0, images: 0, footnotes: 0, words: 1 }, metadata: {} };
hardening.validateImportDocumentLimits(doc);
let blocked = false;
try { hardening.validateCorrections(Array.from({ length: 5001 }, (_, i) => ({ nodeId: `n-${i}` }))); } catch (error) { blocked = error.message === "INPUT_CORRECTION_LIMIT_EXCEEDED"; }
if (!blocked) throw new Error("correction flood was not blocked");

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
if (!uploads.validateMagicBytes("image/jpeg", jpeg).ok) throw new Error("valid JPEG rejected");
const pdf = new TextEncoder().encode("%PDF-1.7");
if (uploads.validateMagicBytes("image/jpeg", pdf).ok) throw new Error("MIME confusion accepted");
const htmlWithNull = new Uint8Array([60,104,116,109,108,62,0,60,47,104,116,109,108,62]);
if (uploads.validateMagicBytes("text/html", htmlWithNull).ok) throw new Error("binary HTML confusion accepted");
const safe = uploads.sanitizeFileName("../../học liệu.docx");
if (safe.includes("/") || safe.includes("..")) throw new Error("file-name sanitization failed");
console.log("Phase 7 hardening runtime passed: limits, retry policy, telemetry redaction, MIME confusion and filename safety.");
