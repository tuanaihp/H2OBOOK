import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/design-library/page.tsx",
  "components/design-library/design-library-client.tsx",
  "components/design-library/design-configurator.tsx",
  "components/design-library/design-template-preview.tsx",
  "components/design-library/design-library.module.css",
  "lib/design-library/catalog.ts",
  "lib/design-library/build-design-book.ts",
  "lib/design-library/formats.ts",
  "lib/design-library/smart-fields.ts",
  "lib/design-library/bulk.ts",
  "types/design-library.ts",
  "public/design-library/portrait-placeholder.svg",
  "public/design-library/academy-placeholder.svg",
  "public/design-library/makeup-tools-placeholder.svg",
  "public/design-library/certificate-seal.svg"
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing design library files:\n" + missing.join("\n"));
  process.exit(1);
}
const catalog = fs.readFileSync(path.join(root, "lib/design-library/catalog.ts"), "utf8");
for (const marker of ["fanpage-cover", "personal-profile", "student-invitation", "makeup-certificate", "makeup-promotion", "bulkCapable", "verificationUrl"]) {
  if (!catalog.includes(marker)) {
    console.error(`Catalog marker missing: ${marker}`);
    process.exit(1);
  }
}
console.log(`Design Library module validation passed (${required.length} required files).`);
