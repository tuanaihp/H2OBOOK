import fs from "node:fs";
import path from "node:path";
const dir=path.resolve("supabase/migrations");
const files=fs.readdirSync(dir).filter((f)=>f.endsWith(".sql")).sort();
const sql=files.map((f)=>fs.readFileSync(path.join(dir,f),"utf8")).join("\n").toLowerCase();
const required=["brand_profiles","templates","classes","assignments","quizzes","review_requests","license_agreements","white_label_portals","learning_goals","flashcards","knowledge_sources","reusable_blocks"];
const missing=required.filter((table)=>!sql.includes(`alter table public.${table} enable row level security`));
if(missing.length){console.error("Missing RLS:",missing.join(", "));process.exit(1);}console.log(`SQL policy check passed for ${required.length} domain tables.`);
