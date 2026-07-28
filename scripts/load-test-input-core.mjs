import fs from "node:fs";
import vm from "node:vm";
import { loadTypeScript } from "./lib/load-typescript.mjs";
const ts = await loadTypeScript();

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}
const hardeningModule = { exports: {} };
vm.runInNewContext(transpile("packages/input-core/src/hardening.ts"), { module: hardeningModule, exports: hardeningModule.exports, require: () => ({}), crypto, TextEncoder, Math, Date, JSON, Set, Error }, { filename: "hardening.cjs" });
const hardening = hardeningModule.exports;

const count = Number(process.env.INPUT_LOAD_TEST_NODES ?? 20_000);
const children = Array.from({ length: count }, (_, index) => ({ id: crypto.randomUUID(), type: "paragraph", parentId: "chapter", position: index, text: [{ text: `Paragraph ${index} with bounded content.` }], attrs: {}, children: [], version: 1 }));
const chapter = { id: "chapter", type: "chapter", parentId: null, position: 0, text: [{ text: "Load" }], attrs: {}, children, version: 1 };
const now = new Date().toISOString();
const preview = { format: "txt", sourceFileName: "load.txt", title: "Load", document: { id: crypto.randomUUID(), bookId: crypto.randomUUID(), title: "Load", language: "vi", root: [chapter], metadata: {}, version: 1, createdAt: now, updatedAt: now }, nodes: [chapter], assets: [], warnings: [], statistics: { nodes: count + 1, headings: 0, paragraphs: count, lists: 0, tables: 0, images: 0, footnotes: 0, words: count * 5 }, metadata: {} };
const before = process.memoryUsage().heapUsed;
const started = performance.now();
const measured = hardening.validateImportDocumentLimits(preview);
const durationMs = Math.round(performance.now() - started);
const heapDeltaMb = Math.round((process.memoryUsage().heapUsed - before) / 1024 / 1024);
if (measured.nodes !== count + 1) throw new Error("node count mismatch");
if (durationMs > Number(process.env.INPUT_LOAD_TEST_MAX_MS ?? 2500)) throw new Error(`load validation too slow: ${durationMs}ms`);
console.log(JSON.stringify({ ok: true, nodes: measured.nodes, durationMs, heapDeltaMb }));
