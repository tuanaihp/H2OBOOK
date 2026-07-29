import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const must = [
  "packages/input-core/src/hardening.ts",
  "lib/observability/input-observability.ts",
  "lib/security/request-limits.ts",
  "lib/input/api-errors.ts",
  "app/api/internal/input/recover-stale/route.ts",
  "app/api/health/input/route.ts",
  "supabase/migrations/0022_h2obook_v4137_production_hardening.sql",
  "tests/security/input-hardening.test.ts",
  "tests/security/test_processor_hardening.py",
  "tests/integration/input-recovery.test.ts",
  "tests/e2e/input-orchestrator.spec.ts",
  "scripts/test-input-hardening-runtime.mjs",
  "scripts/load-test-input-core.mjs",
  "docs/runbooks/INPUT-ROLLBACK-RUNBOOK.md",
  "docs/runbooks/INPUT-INCIDENT-RUNBOOK.md",
];
const missing = must.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Phase 7 missing files: ${missing.join(", ")}`);
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));
const hardening = read("packages/input-core/src/hardening.ts");
const worker = read("workers/document-worker/index.mjs");
const processor = read("services/document-processor/app/processors.py");
const api = read("app/api/input/sessions/[id]/preview/route.ts");
const sql = read("supabase/migrations/0022_h2obook_v4137_production_hardening.sql");
const compose = read("docker-compose.production.yml");
const assertions = [
  [/^4\.(?:13\.(?:[7-9]|[1-9]\d+)|1[4-9]\.\d+)$/.test(pkg.version), "package version must be 4.13.7 or newer"],
  [pkg.scripts?.["validate:input-phase7"]?.includes("validate-input-phase7"), "phase 7 validation script missing"],
  [pkg.scripts?.["test:input-hardening"]?.includes("test-input-hardening-runtime"), "hardening runtime script missing"],
  [hardening.includes("DEFAULT_INPUT_HARDENING_LIMITS") && hardening.includes("redactInputTelemetry"), "limits/redaction missing"],
  [hardening.includes("getInputRuntimePolicy") && hardening.includes("computeRetryDelayMs"), "timeout/retry policy missing"],
  [worker.includes("heartbeat") && worker.includes("cancellationRequested") && worker.includes("WORKER_TIMEOUT"), "worker heartbeat/cancel/timeout missing"],
  [worker.includes("previewFromResult") && worker.includes("input_sessions"), "worker-session callback missing"],
  [processor.includes("ZIP_BOMB_RISK") && processor.includes("ZIP_PATH_TRAVERSAL") && processor.includes("ZIP_SYMLINK_NOT_ALLOWED"), "processor archive hardening missing"],
  [api.includes("readJsonBody") && api.includes("65 * 1024 * 1024"), "preview request limit missing"],
  [sql.includes("recover_stale_input_sessions") && sql.includes("for update skip locked"), "stale session recovery missing"],
  [sql.includes("commit_input_session_hardened") && sql.includes("IMPORT_NODE_LIMIT_EXCEEDED"), "database commit limits missing"],
  [sql.includes("input_sessions_owner_update") && sql.includes("requested_by = auth.uid()"), "RLS ownership hardening missing"],
  [compose.includes("input-recovery"), "scheduled recovery service missing"],
  [!fs.existsSync(path.join(root, "node_modules")) && !fs.existsSync(path.join(root, ".next")), "build/cache artifacts must not ship"],
];
const failed = assertions.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) throw new Error(`Phase 7 validation failed:\n- ${failed.join("\n- ")}`);
console.log(`Phase 7 Production Hardening validation passed: ${must.length} required files, ${assertions.length} architecture assertions.`);
