import fs from "node:fs";import path from "node:path";const root=process.cwd();
const required=["lib/editor/json-patch.ts","lib/editor/rich-text.ts","lib/editor/preflight.ts","components/editor/compose-workspace.tsx","app/editor/[bookId]/compose/page.tsx","app/preflight/page.tsx","supabase/migrations/0009_h2obook_v43_authoring_editor.sql"];
const missing=required.filter((file)=>!fs.existsSync(path.join(root,file)));if(missing.length){console.error("Missing 4.3 files:",missing);process.exit(1);}
const store=fs.readFileSync(path.join(root,"store/editor-store.ts"),"utf8");if(store.includes("HistorySnapshot")||store.includes("structuredClone(snap.book)"))throw new Error("Editor still uses whole-book snapshot history");
for(const marker of ["diffJson","applyJsonPatch","committedBook"])if(!store.includes(marker))throw new Error(`Patch history missing ${marker}`);
const canvas=fs.readFileSync(path.join(root,"components/editor/editor-canvas.tsx"),"utf8");if(!canvas.includes('import("qrcode")'))throw new Error("Real QR renderer missing");
const migration=fs.readFileSync(path.join(root,"supabase/migrations/0009_h2obook_v43_authoring_editor.sql"),"utf8");for(const marker of ["editor_operations","track_changes","preflight_reports"])if(!migration.includes(marker))throw new Error(`Migration 4.3 missing ${marker}`);
console.log(`H2OBOOK 4.3 Authoring Editor validation passed (${required.length} files).`);
