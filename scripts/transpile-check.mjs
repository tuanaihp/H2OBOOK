import fs from "node:fs";
import path from "node:path";
import { loadTypeScript } from "./lib/load-typescript.mjs";
const ts = await loadTypeScript();

const root = process.cwd();
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (["node_modules",".next",".git"].includes(entry.name)) continue;
    const full = path.join(dir,entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) files.push(full);
  }
}
walk(root);
const failures=[];
for (const file of files) {
  const text=fs.readFileSync(file,"utf8");
  const result=ts.transpileModule(text,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,isolatedModules:true}});
  for (const diagnostic of result.diagnostics ?? []) {
    const message=ts.flattenDiagnosticMessageText(diagnostic.messageText," ");
    const pos=diagnostic.start == null ? "" : (()=>{const lc=ts.getLineAndCharacterOfPosition(ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),diagnostic.start);return `:${lc.line+1}:${lc.character+1}`;})();
    failures.push(`${path.relative(root,file)}${pos} ${message}`);
  }
}
if(failures.length){console.error(`TypeScript syntax/transpile check failed:\n- ${failures.join("\n- ")}`);process.exit(1);}
console.log(`TypeScript syntax/transpile check passed: ${files.length} files.`);
