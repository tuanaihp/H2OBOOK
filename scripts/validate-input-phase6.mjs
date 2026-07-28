import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const must = [
  "packages/input-core/src/orchestrator.ts",
  "lib/input/orchestrator-server.ts",
  "lib/input/orchestrator-client.ts",
  "components/input/unified-input-gateway.tsx",
  "app/input/page.tsx",
  "app/api/input/sessions/route.ts",
  "app/api/input/sessions/[id]/route.ts",
  "app/api/input/sessions/[id]/preview/route.ts",
  "app/api/input/sessions/[id]/commit/route.ts",
  "app/api/input/sessions/[id]/retry/route.ts",
  "app/api/input/sessions/[id]/cancel/route.ts",
  "app/api/input/sessions/[id]/recover/route.ts",
  "supabase/migrations/0021_h2obook_v4136_input_orchestrator.sql",
  "tests/unit/input-orchestrator.test.ts",
];
const missing = must.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Phase 6 missing files: ${missing.join(", ")}`);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));
const core = read("packages/input-core/src/orchestrator.ts");
const server = read("lib/input/orchestrator-server.ts");
const client = read("lib/input/orchestrator-client.ts");
const ui = read("components/input/unified-input-gateway.tsx");
const editor = read("components/editor/editor-workspace.tsx");
const sql = read("supabase/migrations/0021_h2obook_v4136_input_orchestrator.sql");
const assertions = [
  [/^4\.(?:13\.(?:[6-9]|[1-9]\d+)|14\.\d+)(?:-|$)/.test(pkg.version), "package version must be 4.13.6 or newer"],
  [pkg.scripts?.["validate:input-phase6"]?.includes("validate-input-phase6"), "phase 6 script missing"],
  [core.includes("OrchestratedInputSession") && core.includes("transitionInputSession"), "orchestrator state machine missing"],
  [core.includes("inputFingerprint") && core.includes("appendImportAsChapter"), "idempotency/append logic missing"],
  [server.includes("createInputSession") && server.includes("saveInputPreview") && server.includes("commitInputSession"), "server orchestration missing"],
  [server.includes("retryInputSession") && server.includes("cancelInputSession"), "retry/cancel missing"],
  [client.includes("recoverOrchestratedInput") && client.includes("h2obook-input-sessions-v1"), "offline recovery cache missing"],
  [["DOCX", "PDF", "Image", "HTML", "Markdown", "TXT", "URL"].every((token) => ui.includes(token)), "unified gateway format coverage missing"],
  [ui.includes("Commit vào H2OBOOK") && ui.includes("Recovery") && ui.includes("Retry"), "preview/commit/recovery UI missing"],
  [editor.includes("Mở Unified Input Gateway") && editor.includes("Nhập nhanh legacy"), "editor migration/deprecation UI missing"],
  [sql.includes("create table if not exists public.input_sessions") && sql.includes("unique(organization_id,idempotency_key)"), "session persistence/idempotency missing"],
  [sql.includes("commit_input_session") && sql.includes("for update"), "atomic commit/locking missing"],
  [sql.includes("recovery_required") && sql.includes("input_session_events"), "recovery/event log missing"],
  [sql.includes("table_row") && sql.includes("table_cell"), "semantic node constraint parity missing"],
];
const failed = assertions.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) throw new Error(`Phase 6 validation failed:\n- ${failed.join("\n- ")}`);
console.log(`Phase 6 Unified Orchestrator validation passed: ${must.length} required files, ${assertions.length} architecture assertions.`);
