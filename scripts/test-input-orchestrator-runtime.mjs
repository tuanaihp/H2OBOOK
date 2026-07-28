import fs from "node:fs";
import vm from "node:vm";
import { loadTypeScript } from "./lib/load-typescript.mjs";
const ts = await loadTypeScript();

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}
const baseContext = { crypto: globalThis.crypto, console, Date, Math, JSON, Map, Set, Error, TextEncoder, TextDecoder, Uint8Array };
const hardeningModule = { exports: {} };
vm.runInNewContext(transpile("packages/input-core/src/hardening.ts"), { ...baseContext, module: hardeningModule, exports: hardeningModule.exports, require: () => ({}) }, { filename: "hardening.runtime.cjs" });
const module = { exports: {} };
const context = { ...baseContext, module, exports: module.exports, require: (name) => name === "./hardening" ? hardeningModule.exports : {} };
vm.runInNewContext(transpile("packages/input-core/src/orchestrator.ts"), context, { filename: "orchestrator.runtime.cjs" });
const api = module.exports;
const sourceFile = { kind: "file", fileName: "guide.md", mimeType: "text/markdown", sizeBytes: 120 };
const destination = { type: "new_book" };
const session = api.createOrchestratedSession({ sourceName: "guide.md", format: "markdown", mode: "editable_content", source: sourceFile, destination });
if (session.status !== "created" || !session.deadlineAt) throw new Error("session creation failed");
const detected = api.transitionInputSession(session, "detected", { progress: 5 });
const validating = api.transitionInputSession(detected, "validating", { progress: 12 });
const processing = api.transitionInputSession(validating, "processing", { progress: 35 });
const preview = api.plainTextToImportDocument({ sourceFileName: "guide.md", text: "# Chương 1\nNội dung", format: "markdown", bookId: globalThis.crypto.randomUUID() });
const ready = api.importDocumentToSessionPreview(processing, preview);
if (ready.status !== "preview" || ready.progress !== 85) throw new Error("preview transition failed");
const fingerprintA = api.inputFingerprint({ format: "markdown", mode: "editable_content", source: sourceFile, destination });
const fingerprintB = api.inputFingerprint({ format: "markdown", mode: "editable_content", source: sourceFile, destination });
if (fingerprintA !== fingerprintB) throw new Error("fingerprint is not deterministic");
const paragraph = preview.document.root[0].children.find((node) => node.type === "paragraph");
const corrected = api.applyInputCorrections(preview.document, [{ nodeId: paragraph.id, text: "Đã sửa" }]);
if (corrected.root[0].children.find((node) => node.id === paragraph.id).text[0].text !== "Đã sửa") throw new Error("correction failed");
const merged = api.appendImportAsChapter(preview.document, corrected, "Bổ sung");
if (merged.root.length !== preview.document.root.length + 1) throw new Error("append chapter failed");
console.log("Unified Input Orchestrator runtime passed: transitions, deadlines, preview, deterministic idempotency, correction and append.");
