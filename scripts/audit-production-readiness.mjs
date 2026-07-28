import fs from "node:fs";
import { spawnSync } from "node:child_process";

const checks = [];
const add = (name, status, detail) => checks.push({ name, status, detail });
add("pnpm-lock.yaml", fs.existsSync("pnpm-lock.yaml") ? "pass" : "blocked", fs.existsSync("pnpm-lock.yaml") ? "Lockfile present." : "Registry access is required to generate and commit the real lockfile.");
add("node_modules", fs.existsSync("node_modules") ? "pass" : "blocked", fs.existsSync("node_modules") ? "Dependencies installed." : "Dependencies are not installed in this packaging environment.");
for (const [name, command] of [
  ["phase7-static", ["node", "scripts/validate-input-phase7.mjs"]],
  ["hardening-runtime", ["node", "scripts/test-input-hardening-runtime.mjs"]],
  ["processor-hardening", ["python3", "tests/security/test_processor_hardening.py"]],
  ["load-test", ["node", "scripts/load-test-input-core.mjs"]],
]) {
  const result = spawnSync(command[0], command.slice(1), { encoding: "utf8" });
  add(name, result.status === 0 ? "pass" : "fail", (result.stdout || result.stderr || "").trim().slice(0, 600));
}
const external = ["SUPABASE", "REDIS", "R2", "CLAMAV"].map(name => ({ name: `${name.toLowerCase()}-integration`, status: "external", detail: "Requires a real local/staging service and credentials." }));
checks.push(...external);
const releaseReady = checks.every(item => item.status === "pass");
const report = { version: "4.14.0", generatedAt: new Date().toISOString(), releaseReady, checks };
fs.writeFileSync("docs/PRODUCTION-READINESS-AUDIT-4.14.0.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
