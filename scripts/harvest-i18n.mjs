// One-off: harvest user-facing UI strings from app/ + components/ so the VI<->EN dictionary can be
// built from what the app actually renders rather than guessed. Not wired into CI.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components"];
const VI_RE = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) { if (!/node_modules|\.next/.test(p)) walk(p); }
    else if (/\.(tsx|ts)$/.test(name)) files.push(p);
  }
}
ROOTS.forEach(walk);

// Reject anything that smells like code rather than prose.
const CODE_HINT = /[{}<>$=|&`\\]|=>|::|\b(const|let|return|function|useState|Promise|Record|Partial|string|number|boolean|null|undefined|import|export|await|async)\b|\)\s*;|\(\)|\[\]/;
const counts = new Map();
const add = (raw) => {
  const v = raw.replace(/\s+/g, " ").trim();
  if (!v || v.length < 2 || v.length > 180) return;
  if (CODE_HINT.test(v)) return;
  if (/^[\d\s.,:%/–—×+-]+$/.test(v)) return;
  if (/^[a-z0-9_.-]+$/i.test(v) && !/\s/.test(v)) return;
  if (/^(https?:|\/|#|@|--)/.test(v)) return;
  if (!/[a-zà-ỹ]/i.test(v)) return;                 // must contain a letter
  counts.set(v, (counts.get(v) ?? 0) + 1);
};

for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/>\s*([^<>{}\n][^<>{}]*?)\s*</g)) add(m[1]);
  for (const m of src.matchAll(/(?:placeholder|title|aria-label|alt|label|description|subtitle|heading|cta|eyebrow|tooltip|summary|hint|caption|name)\s*[=:]\s*"([^"\n]{2,180})"/g)) add(m[1]);
  for (const m of src.matchAll(/\{"\s*([^"\n]{2,180}?)\s*"\}/g)) add(m[1]);
  for (const m of src.matchAll(/\{`\s*([^`$\n]{2,180}?)\s*`\}/g)) add(m[1]);
}

const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const vi = sorted.filter(([s]) => VI_RE.test(s));
const en = sorted.filter(([s]) => !VI_RE.test(s));

writeFileSync("scripts/i18n-harvest.json", JSON.stringify({
  totalUnique: sorted.length, viCount: vi.length, enCount: en.length,
  vi: vi.map(([s, c]) => [c, s]),
  en: en.map(([s, c]) => [c, s]),
}, null, 2));
console.log(`files=${files.length} unique=${sorted.length} vi=${vi.length} en=${en.length}`);
