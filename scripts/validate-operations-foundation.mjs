import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "types/operations.ts",
  "lib/operations/data.ts",
  "lib/operations/permissions.ts",
  "lib/operations/routes.ts",
  "lib/operations/feature.ts",
  "store/operations-store.ts",
  "components/operations/operations-shell.tsx",
  "components/operations/customer-shell.tsx",
  "components/operations/operations-dashboard.tsx",
  "components/operations/instructor-dashboard.tsx",
  "components/operations/platform-dashboard.tsx",
  "app/customer/page.tsx",
  "app/instructor/page.tsx",
  "app/operations/page.tsx",
  "app/platform-admin/page.tsx",
  "app/verify/[certificateNo]/page.tsx"
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing operations foundation files:\n" + missing.map((file) => `- ${file}`).join("\n"));
  process.exit(1);
}

const routes = ["customer", "instructor", "operations", "platform-admin"];
for (const route of routes) {
  const page = path.join(root, "app", route, "page.tsx");
  if (!fs.existsSync(page)) throw new Error(`Missing route ${route}`);
}

const types = fs.readFileSync(path.join(root, "types/operations.ts"), "utf8");
for (const name of ["AdmissionLead", "CustomerApplication", "SupportTicket", "ApprovalRequest", "CertificateIssue"]) {
  if (!types.includes(`type ${name}`)) throw new Error(`Missing type ${name}`);
}

const permissions = fs.readFileSync(path.join(root, "lib/operations/permissions.ts"), "utf8");
if (!permissions.includes("platform_admin") || !permissions.includes("instructor")) throw new Error("Role boundaries are incomplete");

console.log(`Operations foundation validation passed: ${required.length} core files, ${routes.length} route spaces.`);
