import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const required = [
  "app/learn/page.tsx","app/study/page.tsx","app/knowledge/page.tsx","app/blocks/page.tsx",
  "app/smart-settings/page.tsx","app/offline/page.tsx","lib/local-smart-engine.ts","lib/v4-seed.ts",
  "components/smart/command-center.tsx","components/providers/smart-ui-provider.tsx","components/providers/pwa-register.tsx",
  "public/sw.js","public/icons/icon.svg","supabase/migrations/0006_h2obook_v4_smart_core.sql",
  "app/api/v4/capabilities/route.ts"
];
const missing = required.filter((file) => !fs.existsSync(path.join(root,file)));
if (missing.length) { console.error("Missing V4 files:", missing); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
if (!/^4\.[1-9]\d*\.\d+$/.test(pkg.version)) throw new Error("Professional package version mismatch");
const store = fs.readFileSync(path.join(root,"store/app-store.ts"),"utf8");
for (const marker of ["smartSettings","learningGoals","flashcards","studySessions","knowledgeSources","reusableBlocks","version: 4"]) if (!store.includes(marker)) throw new Error(`Missing store marker: ${marker}`);
const migration = fs.readFileSync(path.join(root,"supabase/migrations/0006_h2obook_v4_smart_core.sql"),"utf8");
for (const marker of ["smart_core_settings","learning_goals","flashcards","study_sessions","knowledge_sources","reusable_blocks","review_flashcard"]) if (!migration.includes(marker)) throw new Error(`Missing migration marker: ${marker}`);
const localEngine = fs.readFileSync(path.join(root,"lib/local-smart-engine.ts"),"utf8");
if (/fetch\(|AI_GATEWAY|OPENAI|GEMINI/i.test(localEngine)) throw new Error("Local Smart Engine must not depend on external APIs");
console.log(`H2OBOOK V4 Smart Core validation passed: ${required.length} required files, AI-independent local engine.`);
