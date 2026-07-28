import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const required = [
  "app/login/page.tsx", "app/api/readiness/route.ts", "app/api/storage/presign-upload/route.ts",
  "app/api/storage/presign-download/route.ts", "app/api/payments/webhook/[provider]/route.ts",
  "app/api/books/cloud-save/route.ts", "app/api/assets/route.ts", "app/cloud-sync/page.tsx",
  "supabase/migrations/0004_h2obook_production_core.sql", "supabase/migrations/0005_h2obook_security_hardening.sql",
  "services/document-processor/app/main.py", "workers/document-worker/index.mjs", "docker-compose.production.yml", "middleware.ts",
  "app/learn/page.tsx", "app/study/page.tsx", "lib/local-smart-engine.ts", "supabase/migrations/0006_h2obook_v4_smart_core.sql"
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) { console.error("Missing production files:", missing); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!/^4\.(?:[1-9]|1[0-9])\.\d+$/.test(pkg.version)) throw new Error("Unexpected package version");
const worker = fs.readFileSync(path.join(root, "workers/document-worker/index.mjs"), "utf8");
if (worker.includes("worker-scaffold")) throw new Error("Document worker is still a scaffold");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0005_h2obook_security_hardening.sql"), "utf8");
for (const marker of ["pending_access_grants", "claim_my_pending_access", "save_book_document", "handle_new_user"]) if (!migration.includes(marker)) throw new Error(`Missing migration marker: ${marker}`);
console.log(`H2OBOOK smoke test passed: ${required.length} production files, version ${pkg.version}.`);
