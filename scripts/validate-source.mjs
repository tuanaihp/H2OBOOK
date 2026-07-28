import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const required = [
  "app/dashboard/page.tsx", "app/books/page.tsx", "app/editor/[bookId]/page.tsx",
  "app/reader/[slug]/page.tsx", "app/templates/page.tsx", "app/clones/page.tsx",
  "app/classes/page.tsx", "app/assignments/page.tsx", "app/quizzes/page.tsx",
  "app/store/page.tsx", "app/orders/page.tsx", "store/app-store.ts",
  "app/ai-studio/page.tsx", "app/reviews/page.tsx", "app/collaboration/page.tsx",
  "app/automations/page.tsx", "app/licensing/page.tsx", "app/white-label/page.tsx",
  "app/content-health/page.tsx", "store/editor-store.ts", "supabase/migrations/0001_h2obook_core.sql",
  "supabase/migrations/0002_h2obook_v2_integrated.sql", "supabase/migrations/0003_h2obook_v3_integrated.sql",
  "supabase/migrations/0004_h2obook_production_core.sql", "supabase/migrations/0005_h2obook_security_hardening.sql",
  "app/login/page.tsx", "app/integrations/page.tsx", "app/cloud-sync/page.tsx", "app/processing/page.tsx",
  "app/security/page.tsx", "app/assets/page.tsx", "app/api/books/cloud-save/route.ts",
  "app/api/books/cloud-load/route.ts", "app/api/assets/route.ts", "lib/security/file-scan.ts",
  "services/document-processor/app/main.py", "services/document-processor/app/processors.py", "services/document-processor/Dockerfile",
  "Dockerfile", "Dockerfile.worker", "docker-compose.production.yml", "middleware.ts",
  "supabase/migrations/0006_h2obook_v4_smart_core.sql", "app/learn/page.tsx", "app/study/page.tsx",
  "app/knowledge/page.tsx", "app/blocks/page.tsx", "app/smart-settings/page.tsx", "app/offline/page.tsx",
  "lib/local-smart-engine.ts", "public/sw.js"
];
const failures = [];
for (const file of required) {
  try { statSync(join(root, file)); } catch { failures.push(`Thiếu file bắt buộc: ${file}`); }
}
function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path)); else files.push(path);
  }
  return files;
}
for (const file of walk(root)) {
  if (!/\.(ts|tsx|sql|md|json|css|mjs)$/.test(file)) continue;
  const content = readFileSync(file, "utf8");
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(content)) failures.push(`Còn merge marker: ${relative(root, file)}`);
  if (/SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s]+/.test(content) && !content.includes("SUPABASE_SERVICE_ROLE_KEY=")) failures.push(`Có khả năng chứa secret: ${relative(root, file)}`);
}
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!/^4\.(?:[1-9]|1[0-9])\.\d+$/.test(packageJson.version)) failures.push("package.json phải ở nhánh Professional 4.1+");
const migration1 = readFileSync(join(root, "supabase/migrations/0001_h2obook_core.sql"), "utf8");
const migration2 = readFileSync(join(root, "supabase/migrations/0002_h2obook_v2_integrated.sql"), "utf8");
const migration3 = readFileSync(join(root, "supabase/migrations/0003_h2obook_v3_integrated.sql"), "utf8");
const migration4 = readFileSync(join(root, "supabase/migrations/0004_h2obook_production_core.sql"), "utf8");
const migration5 = readFileSync(join(root, "supabase/migrations/0005_h2obook_security_hardening.sql"), "utf8");
const migration6 = readFileSync(join(root, "supabase/migrations/0006_h2obook_v4_smart_core.sql"), "utf8");
if (!/\bbegin\s*;/i.test(migration2) || !/\bcommit\s*;/i.test(migration2)) failures.push("Migration V2 thiếu BEGIN/COMMIT");
if (!/\bbegin\s*;/i.test(migration3) || !/\bcommit\s*;/i.test(migration3)) failures.push("Migration V3 thiếu BEGIN/COMMIT");
if (!/create table if not exists public\.review_requests/i.test(migration3)) failures.push("Migration V3 thiếu review workflow");
if (!/create table if not exists public\.license_agreements/i.test(migration3)) failures.push("Migration V3 thiếu licensing");
if (!/create table public\.books/i.test(migration1)) failures.push("Migration V1 thiếu bảng books");
if (!/create table if not exists public\.workspace_snapshots/i.test(migration4)) failures.push("Migration V3.5 thiếu cloud snapshots");
if (!/create table if not exists public\.payment_events/i.test(migration4)) failures.push("Migration V3.5 thiếu payment events");
if (!/can_access_publication/i.test(migration5)) failures.push("Migration V3.5 thiếu access hardening");
if (!/save_book_document/i.test(migration5)) failures.push("Migration V3.5 thiếu atomic cloud save RPC");
if (!/client_key/i.test(migration5)) failures.push("Migration V3.5 thiếu client key mapping");
if (!/create table if not exists public\.pending_access_grants/i.test(migration5)) failures.push("Migration V3.5 thiếu pending access grants");
if (!/claim_my_pending_access/i.test(migration5)) failures.push("Migration V3.5 thiếu guest entitlement claim");
if (!/create or replace function public\.handle_new_user/i.test(migration5)) failures.push("Migration V3.5 thiếu workspace bootstrap trigger");
if (!/create table if not exists public\.flashcards/i.test(migration6)) failures.push("Migration V4 thiếu flashcards");
if (!/create table if not exists public\.smart_core_settings/i.test(migration6)) failures.push("Migration V4 thiếu Smart Core settings");
if (failures.length) {
  console.error("H2OBOOK source validation failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`H2OBOOK Professional validation passed (${required.length} core files checked).`);
