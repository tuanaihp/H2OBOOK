import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const required=[
  "packages/content-core/src/types.ts","packages/content-core/src/legacy-adapter.ts","packages/content-core/src/operations.ts",
  "lib/assets/local-asset-store.ts","lib/assets/asset-client.ts","lib/content-document.ts",
  "app/api/books/[bookId]/document/route.ts","app/api/assets/[id]/url/route.ts",
  "supabase/migrations/0008_h2obook_v42_semantic_content.sql"
];
const missing=required.filter((file)=>!fs.existsSync(path.join(root,file)));
if(missing.length){console.error("Missing 4.2 files:",missing);process.exit(1);}
const migration=fs.readFileSync(path.join(root,"supabase/migrations/0008_h2obook_v42_semantic_content.sql"),"utf8");
for(const marker of ["book_documents","content_nodes","layout_profiles","layout_frames","asset_variants","save_book_semantic_document"])if(!migration.includes(marker))throw new Error(`Migration 4.2 missing ${marker}`);
const editorTypes=fs.readFileSync(path.join(root,"types/editor.ts"),"utf8");
for(const marker of ["assetId?: string","documentId?: string","contentNodeId?: string"])if(!editorTypes.includes(marker))throw new Error(`Editor types missing ${marker}`);
const workspace=fs.readFileSync(path.join(root,"components/editor/editor-workspace.tsx"),"utf8");
if(workspace.includes("readAsDataURL"))throw new Error("Editor still stores uploaded images as Data URLs");
console.log(`H2OBOOK 4.2 Semantic Content validation passed (${required.length} files).`);
