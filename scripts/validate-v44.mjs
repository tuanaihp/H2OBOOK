import fs from "node:fs";import path from "node:path";const root=process.cwd();
const required=["packages/publishing-core/src/html.ts","packages/publishing-core/src/epub.ts","packages/publishing-core/src/scorm.ts","app/publish/page.tsx","app/api/publishing/jobs/route.ts","services/publishing-worker/index.mjs","services/publishing-worker/Dockerfile","supabase/migrations/0010_h2obook_v44_publishing_engine.sql"];
const missing=required.filter((file)=>!fs.existsSync(path.join(root,file)));if(missing.length){console.error("Missing 4.4 files:",missing);process.exit(1);}
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));for(const dep of ["jszip","playwright-core"])if(!pkg.dependencies?.[dep])throw new Error(`Missing publishing dependency ${dep}`);
const epub=fs.readFileSync(path.join(root,"packages/publishing-core/src/epub.ts"),"utf8");for(const marker of ["application/epub+zip","content.opf","nav.xhtml"])if(!epub.includes(marker))throw new Error(`EPUB engine missing ${marker}`);
const migration=fs.readFileSync(path.join(root,"supabase/migrations/0010_h2obook_v44_publishing_engine.sql"),"utf8");for(const marker of ["publishing_jobs","publishing_artifacts","lms_packages"])if(!migration.includes(marker))throw new Error(`Publishing migration missing ${marker}`);
console.log(`H2OBOOK 4.4 Publishing Engine validation passed (${required.length} files).`);
