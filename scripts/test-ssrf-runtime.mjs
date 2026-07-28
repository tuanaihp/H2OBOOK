import fs from "node:fs";
import vm from "node:vm";
import { loadTypeScript } from "./lib/load-typescript.mjs";
const ts = await loadTypeScript();
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const source = fs.readFileSync("lib/ingestion/safe-fetch.ts", "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(output, { module, exports: module.exports, require, URL, fetch, AbortController, TextDecoder, Uint8Array, setTimeout, clearTimeout, Error, console }, { filename: "safe-fetch.cjs" });
const { validatePublicTarget } = module.exports;
for (const value of ["http://127.0.0.1", "http://10.0.0.1", "http://169.254.169.254", "http://[::1]", "http://[::ffff:7f00:1]", "http://[fc00::1]"]) {
  let blocked = false;
  try { await validatePublicTarget(new URL(value)); } catch (error) { blocked = ["PRIVATE_ADDRESS_BLOCKED", "PRIVATE_HOST_BLOCKED"].includes(error.message); }
  if (!blocked) throw new Error(`SSRF target was not blocked: ${value}`);
}
let credentialsBlocked = false;
try { await validatePublicTarget(new URL("https://user:pass@example.com")); } catch (error) { credentialsBlocked = error.message === "URL_CREDENTIALS_NOT_ALLOWED"; }
if (!credentialsBlocked) throw new Error("credentialed URL was not blocked");
console.log("SSRF runtime passed: IPv4, IPv6, mapped IPv6, metadata IP and credentialed URLs are blocked.");
