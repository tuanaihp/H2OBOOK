import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const required=[
  "components/public-home-v3/public-home-v3.tsx",
  "components/public-home-v3/journey-planner.tsx",
  "components/public-home-v3/tracked-link.tsx",
  "components/public-home-v3/section-observer.tsx",
  "components/public-home-v3/public-home-v3.module.css",
  "lib/public-home-v3/types.ts",
  "lib/public-home-v3/fallback.ts",
  "lib/public-home-v3/loader.server.ts",
  "app/academy/home-v3-preview/page.tsx",
];
const missing=required.filter(file=>!fs.existsSync(path.join(root,file)));
if(missing.length){console.error("Missing Public Home V3 files:\n"+missing.join("\n"));process.exit(1)}
const source=fs.readFileSync(path.join(root,"components/public-home-v3/public-home-v3.tsx"),"utf8");
for(const token of ["PublicHomeSectionObserver","JourneyPlanner","data-public-home-section","TrackedLink"]){if(!source.includes(token)){console.error("Missing token",token);process.exit(1)}}
console.log(`Public Home V3 validator passed (${required.length} files).`);
