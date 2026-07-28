import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const required=[
  "lib/domain/resource-config.ts","lib/domain/repository.ts","lib/domain/service.ts","lib/domain/audit.ts","lib/domain/client.ts",
  "app/api/domain/[resource]/route.ts","app/api/domain/[resource]/[id]/route.ts",
  "supabase/migrations/0007_h2obook_v41_production_foundation.sql","vitest.config.ts","playwright.config.ts",
  ".github/workflows/ci.yml","tests/unit/local-smart-engine.test.ts","tests/e2e/smoke.spec.ts"
];
const missing=required.filter((f)=>!fs.existsSync(path.join(root,f)));
if(missing.length){console.error("Missing 4.1 files:",missing);process.exit(1);}
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
for(const dep of ["vitest","@playwright/test"])if(!pkg.devDependencies?.[dep])throw new Error(`Missing dev dependency ${dep}`);
const rate=fs.readFileSync(path.join(root,"lib/security/rate-limit.ts"),"utf8");
if(!rate.includes("REDIS_URL")||!rate.includes("ioredis"))throw new Error("Redis rate limiter is not configured");
const migration=fs.readFileSync(path.join(root,"supabase/migrations/0007_h2obook_v41_production_foundation.sql"),"utf8");
for(const marker of ["domain_events","capture_domain_event","supabase_realtime"])if(!migration.includes(marker))throw new Error(`Migration 4.1 missing ${marker}`);
console.log(`H2OBOOK 4.1 Production Foundation validation passed (${required.length} files).`);
