import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const must = [
  "lib/input/html-import.server.ts",
  "lib/input/html-import.ts",
  "app/api/input/html/preview/route.ts",
  "app/api/input/html/fetch-asset/route.ts",
  "packages/input-core/src/html.ts",
  "tests/unit/html-import.test.ts",
  "tests/fixtures/input/html/basic.html",
  "tests/fixtures/input/html/malicious.html",
];
const missing = must.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Phase 5 missing files: ${missing.join(", ")}`);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const packageJson = JSON.parse(read("package.json"));
const server = read("lib/input/html-import.server.ts");
const client = read("lib/input/html-import.ts");
const editor = read("components/editor/editor-workspace.tsx");
const uploads = read("lib/security/uploads.ts");
const safeFetch = read("lib/ingestion/safe-fetch.ts");
const urlRoute = read("app/api/ingestion/url/route.ts");
const previewRoute = read("app/api/input/html/preview/route.ts");

const assertions = [
  [/^4\.(?:13\.[5-9]|14\.\d+)/.test(packageJson.version), "package version must be 4.13.5 or newer"],
  [Boolean(packageJson.dependencies?.jsdom), "jsdom must be a runtime dependency"],
  [server.includes('from "jsdom"') && server.includes("parseHtmlImport"), "canonical parser must use JSDOM"],
  [server.includes("sanitizeDocument") && server.includes("HTML_SANITIZED"), "sanitization report missing"],
  [server.includes("parseList") && server.includes("parseTable") && server.includes("figcaption"), "semantic structure handlers missing"],
  [server.includes("SAFE_EMBED_HOSTS") && server.includes("HTML_EMBED_BLOCKED"), "controlled embed policy missing"],
  [client.includes("previewHtmlFile") && client.includes("localizeHtmlAssets"), "client preview/localization missing"],
  [client.includes("/api/input/html/fetch-asset") && client.includes("uploadAsset"), "remote asset localization missing"],
  [editor.includes("HTML IMPORT 2.0") && editor.includes(".html,.htm,.xhtml"), "editor HTML upload UI missing"],
  [uploads.includes('"text/html"') && uploads.includes('"application/xhtml+xml"') && uploads.includes('"htm"'), "HTML upload allowlist missing"],
  [uploads.includes("MAGIC_BYTES_MISMATCH") && uploads.includes("<!doctype"), "HTML content sniffing missing"],
  [safeFetch.includes("safeFetchBinary") && safeFetch.includes("validatePublicTarget"), "safe remote asset fetch missing"],
  [urlRoute.includes("parseHtmlImport") && urlRoute.includes('parser: "jsdom-dom-2.0"'), "URL route does not share canonical parser"],
  [previewRoute.includes("ASSET_SCAN_PENDING") && previewRoute.includes("readStoredObject"), "production source scan/storage path missing"],
];
const failed = assertions.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) throw new Error(`Phase 5 validation failed:\n- ${failed.join("\n- ")}`);
console.log(`Phase 5 HTML Import validation passed: ${must.length} required files, ${assertions.length} architecture assertions.`);
