import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const required=[
  "components/marketing/public-shell.tsx",
  "components/student/student-shell.tsx",
  "lib/public-site/content.ts",
  "lib/student/experience.ts",
  "app/page.tsx",
  "app/academy/layout.tsx",
  "app/academy/books/page.tsx",
  "app/academy/courses/page.tsx",
  "app/academy/strategies/page.tsx",
  "app/academy/learning-paths/page.tsx",
  "app/academy/about/page.tsx",
  "app/academy/membership/page.tsx",
  "app/academy/success-stories/page.tsx",
  "app/student/layout.tsx",
  "app/student/page.tsx",
  "app/student/courses/page.tsx",
  "app/student/library/page.tsx",
  "app/student/assignments/page.tsx",
  "app/student/roadmap/page.tsx",
  "app/student/mentor/page.tsx",
  "app/student/profile/page.tsx",
  "app/api/public/catalog/route.ts",
  "tests/unit/ui-414-content.test.ts",
  "tests/e2e/ui-414.spec.ts"
];
const missing=required.filter(file=>!fs.existsSync(path.join(root,file)));
if(missing.length){console.error("Missing H2OBOOK 4.14 files:\n"+missing.join("\n"));process.exit(1)}
const globals=fs.readFileSync(path.join(root,"app/globals.css"),"utf8");
const checks=[
  ["public academy CSS",globals.includes(".h2o-public-site")],
  ["student shell CSS",globals.includes(".h2o-student-shell")],
  ["mobile student nav",globals.includes(".h2o-student-mobile-nav")],
  ["AI future orb",globals.includes(".h2o-future-orb")],
  ["public feature flag",fs.readFileSync(path.join(root,"app/page.tsx"),"utf8").includes("NEXT_PUBLIC_PUBLIC_SITE_V2")],
  ["student feature flag",fs.readFileSync(path.join(root,"app/student/layout.tsx"),"utf8").includes("NEXT_PUBLIC_STUDENT_EXPERIENCE_V2")],
  ["student role redirect",fs.readFileSync(path.join(root,"middleware.ts"),"utf8").includes('memberRole === "student"')],
  ["public root access",fs.readFileSync(path.join(root,"middleware.ts"),"utf8").includes('pathname === "/"')],
  ["catalog API",fs.readFileSync(path.join(root,"app/api/public/catalog/route.ts"),"utf8").includes("publicCourses")]
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){console.error("H2OBOOK 4.14 checks failed: "+failed.map(([name])=>name).join(", "));process.exit(1)}
const opens=(globals.match(/{/g)||[]).length, closes=(globals.match(/}/g)||[]).length;
if(opens!==closes){console.error(`CSS braces mismatch: ${opens} vs ${closes}`);process.exit(1)}
console.log(`H2OBOOK 4.14 UI validation passed: ${required.length} required files, ${checks.length} architecture checks, ${opens} CSS blocks.`);
