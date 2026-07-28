import fs from "node:fs";
import path from "node:path";
import { loadTypeScript } from "./lib/load-typescript.mjs";
const ts = await loadTypeScript();

const root = process.cwd();
const required = [
  "components/editor/compose-workspace.tsx",
  "lib/editor/tiptap-extensions.ts",
  "lib/editor/tiptap-content.ts",
  "lib/editor/text-flow.ts",
  "tests/unit/text-flow.test.ts",
  "components/editor/editor-workspace.tsx",
  "components/editor/editor-canvas.tsx",
  "lib/editor/preflight.ts",
  "packages/publishing-core/src/html.ts",
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing Editor 4.12 file: ${file}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!/^4\.(12|13)\./.test(pkg.version)) throw new Error(`Expected package version 4.12.x or 4.13.x, found ${pkg.version}`);
for (const dependency of ["@tiptap/react", "@tiptap/pm", "@tiptap/starter-kit", "@tiptap/extension-table"]) {
  if (!pkg.dependencies?.[dependency]) throw new Error(`Missing Compose Engine dependency: ${dependency}`);
}

const compose = fs.readFileSync(path.join(root, "components/editor/compose-workspace.tsx"), "utf8");
if (compose.includes("execCommand")) throw new Error("Deprecated execCommand remains in Compose Engine");
for (const token of ["useEditor", "immediatelyRender: false", "TableKit", "semanticNodesToTiptapDoc", "tiptapDocToSemanticNodes"]) {
  if (!compose.includes(token)) throw new Error(`Compose Engine contract missing: ${token}`);
}

const store = fs.readFileSync(path.join(root, "store/editor-store.ts"), "utf8");
for (const action of ["linkSelectedTextFrames", "reflowTextChain", "reflowAllText", "updateFlowSource", "appendFlowContinuation"]) {
  if (!store.includes(action)) throw new Error(`Text Flow store action missing: ${action}`);
}
const editorTypes = fs.readFileSync(path.join(root, "types/editor.ts"), "utf8");
for (const field of ["flowChainId", "flowOrder", "flowSourceText", "flowMetrics", "flowOverflow"]) {
  if (!editorTypes.includes(field)) throw new Error(`Text Flow model field missing: ${field}`);
}
const preflight = fs.readFileSync(path.join(root, "lib/editor/preflight.ts"), "utf8");
if (!preflight.includes("text_flow_overflow") || !preflight.includes("text_flow_order")) throw new Error("Text Flow preflight rules are missing");
const publishing = fs.readFileSync(path.join(root, "packages/publishing-core/src/html.ts"), "utf8");
for (const token of ["table_row", "table_cell", "renderMark", "flowChainId"]) if (!publishing.includes(token)) throw new Error(`Publishing bridge missing: ${token}`);

const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
if (css.split("{").length !== css.split("}").length) throw new Error("CSS braces are not balanced");
for (const selector of [".compose-v412 .tiptap", ".flow-status-card", ".editor-icon", ".property-field input"]) {
  if (!css.includes(selector)) throw new Error(`Editor 4.12 UI selector missing: ${selector}`);
}

async function importTranspiled(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const flow = await importTranspiled("lib/editor/text-flow.ts");
const frame = (id, order) => ({
  id, pageId: `p-${order}`, pageIndex: order, elementIndex: 0,
  element: { id, type: "text", name: id, x: 0, y: 0, width: 170, height: 72, rotation: 0, opacity: 1, locked: false, hidden: false, fontSize: 16, lineHeight: 1.25, letterSpacing: 0, fontFamily: "Arial", fontWeight: 400, fontStyle: "normal", permissions: {}, flowOrder: order },
});
const source = "H2OBOOK Text Flow tự động phân phối nội dung qua nhiều khung và giữ phần còn lại để cảnh báo.";
const result = flow.flowTextAcrossFrames("flow-test", source, [frame("a", 0), frame("b", 1), frame("c", 2)], flow.deterministicTextMeasure);
if (result.segments.length !== 3) throw new Error("Text Flow did not produce three frame segments");
if (!result.segments.some((segment) => segment.text.length > 0)) throw new Error("Text Flow produced no visible content");
const reconstructed = [...result.segments.map((segment) => segment.text), result.remainingText].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
if (!reconstructed.startsWith("H2OBOOK Text Flow")) throw new Error("Text Flow source reconstruction failed");

const content = await importTranspiled("lib/editor/tiptap-content.ts");
const semantic = [{ id: "chapter-1", type: "chapter", parentId: null, position: 0, attrs: { label: "Chương 1" }, version: 1, children: [
  { id: "heading-1", type: "heading", parentId: "chapter-1", position: 0, attrs: { level: 1 }, version: 1, children: [], text: [{ text: "Tiêu đề", marks: [{ type: "bold" }] }] },
  { id: "table-1", type: "table", parentId: "chapter-1", position: 1, attrs: {}, version: 1, text: undefined, children: [
    { id: "row-1", type: "table_row", parentId: "table-1", position: 0, attrs: {}, version: 1, children: [
      { id: "cell-1", type: "table_cell", parentId: "row-1", position: 0, attrs: { header: true }, version: 1, children: [{ id: "p-1", type: "paragraph", parentId: "cell-1", position: 0, attrs: {}, version: 1, children: [], text: [{ text: "Cột" }] }] },
    ] },
  ] },
] }];
const doc = content.semanticNodesToTiptapDoc(semantic);
const roundTrip = content.tiptapDocToSemanticNodes(doc);
if (roundTrip[0]?.id !== "chapter-1" || roundTrip[0]?.children[0]?.id !== "heading-1") throw new Error("Semantic IDs were not preserved through Compose Engine round-trip");
if (!JSON.stringify(roundTrip).includes("table_cell")) throw new Error("Semantic table was not preserved through Compose Engine round-trip");

console.log(`H2OBOOK Professional Editor 4.12 validation passed: ${required.length} required files, schema round-trip, Text Flow runtime, publishing bridge and enlarged UI.`);
