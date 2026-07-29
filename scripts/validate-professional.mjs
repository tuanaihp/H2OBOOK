import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const required=[
  "packages/content-core/src/types.ts","packages/publishing-core/src/epub.ts","packages/publishing-core/src/xapi.ts",
  "packages/ingestion-core/src/index.ts","packages/automation-core/src/index.ts","packages/growth-reader-core/src/index.ts",
  "packages/education-core/src/index.ts","packages/analytics-core/src/index.ts","packages/optional-assist-core/src/index.ts",
  "packages/enterprise-core/src/index.ts","lib/enterprise/api-auth.ts","lib/enterprise/secret-box.ts",
  "services/publishing-worker/index.mjs","services/webhook-worker/index.mjs","app/api/public/v1/books/route.ts",
  "app/api/reader/campaign/[bookId]/route.ts","app/embed/[slug]/page.tsx",
  "supabase/migrations/0018_h2obook_v411_final_hardening.sql"
];
for(const file of required)if(!fs.existsSync(path.join(root,file)))throw new Error(`Missing professional file: ${file}`);
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
if(!(pkg.version === "4.11.0" || /^4\.(1[2-9])\./.test(pkg.version)))throw new Error(`Unexpected package version ${pkg.version}`);
const capabilities=fs.readFileSync(path.join(root,"app/api/v4/capabilities/route.ts"),"utf8");
if(!capabilities.includes("coreRequiresAI")||!capabilities.includes("false"))throw new Error("No-AI-first capability contract is missing");
const assist=fs.readFileSync(path.join(root,"packages/optional-assist-core/src/index.ts"),"utf8");
if(!assist.includes("enabled:false")&&!assist.includes("enabled: false"))throw new Error("Optional AI must remain disabled by default");
const migrations=fs.readdirSync(path.join(root,"supabase/migrations")).filter(name=>name.endsWith(".sql")).sort();
if(migrations.length<18)throw new Error(`Expected at least 18 migrations, found ${migrations.length}`);
const sourceCount=(dir)=>fs.readdirSync(path.join(root,dir),{recursive:true}).filter(name=>/\.(ts|tsx|mjs|py|sql)$/.test(String(name))).length;
console.log(`H2OBOOK Professional core validation passed: ${required.length} critical files, ${migrations.length} migrations, ${sourceCount("app")} app source files.`);
