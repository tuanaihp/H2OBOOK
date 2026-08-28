// Seeds the 3 rubrics required by spec §C/D/E (Training, Thực hành Makeup, Hair) into the real
// public.rubrics / public.rubric_criteria tables (0026, extended by migration 0060 with
// category/required/skill_key) — no separate rubric_definitions table, per the migration's own
// audit comment. Idempotent: does nothing if a rubric with the same organization_id + category
// already exists, so re-running never creates a duplicate "version" by accident — a real new
// version is a deliberate, separate action (insert a new rubrics row), not a side effect of
// re-seeding.
//
//   node scripts/seed-student-competency-rubrics.mjs                 # dry run, writes nothing
//   node scripts/seed-student-competency-rubrics.mjs --apply         # writes
//   node scripts/seed-student-competency-rubrics.mjs --apply --org=<uuid>

import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();
const orgArg = process.argv.find((arg) => arg.startsWith("--org="));

function readEnv(key) {
  const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

const SUPABASE_URL = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");
// Same production organization every other seed script in this repo targets (see
// scripts/seed-learn-outcome-stage1.mjs) — override with --org=<uuid> for a different tenant.
const ORG_ID = orgArg ? orgArg.split("=")[1] : "4cdbbcbf-d6e1-4d06-bb87-4f63c9cac01f";
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const headers = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
async function rest(pathAndQuery, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status} ${pathAndQuery} :: ${text.slice(0, 400)}`);
  return body;
}
const insertOne = async (table, row) => (await rest(table, { method: "POST", body: JSON.stringify(row), headers: { prefer: "return=representation" } }))[0];

// Spec §C: Training rubric — 100 điểm, 10 tiêu chí × 10 điểm, dùng chung Training Makeup & Tóc.
// All 10 feed the single "training_discipline" competency-profile dimension (spec groups Training
// under discipline/observation, not per-technique scoring).
const TRAINING_CRITERIA = [
  "Kỷ luật & đúng giờ", "Đeo thẻ & tác phong học viên", "Chuẩn bị dụng cụ học tập",
  "Ý thức tập trung nghe giảng", "Quan sát kỹ thuật Demo", "Ghi chép kiến thức",
  "Sử dụng điện thoại đúng mục đích", "Tương tác & đặt câu hỏi",
  "Khả năng tiếp thu & nhắc lại kiến thức", "Hoàn thiện hồ sơ buổi học"
].map((title, i) => ({ title, max_score: 10, position: i, required: true, skill_key: "training_discipline" }));

// Spec §D: Makeup rubric — 100 điểm, 12 tiêu chí theo thang điểm nêu trong PROMPT_FOR_CLAUDE.md.
// skill_key maps each criterion to the matching dimension in spec §G; the two criteria the spec's
// competency list doesn't name a dimension for ("Tư duy học nghề & khả năng sửa lỗi") are left
// without a skill_key rather than guessed onto an unrelated one.
const MAKEUP_CRITERIA = [
  { title: "Nền da & xử lý khuyết điểm", max_score: 15, skill_key: "foundation" },
  { title: "Chân mày", max_score: 10, skill_key: "brows" },
  { title: "Mắt", max_score: 10, skill_key: "eyes" },
  { title: "Mi", max_score: 5, skill_key: "lashes" },
  { title: "Khối & cấu trúc gương mặt", max_score: 10, skill_key: "contour" },
  { title: "Má", max_score: 5, skill_key: "cheeks" },
  { title: "Môi", max_score: 10, skill_key: "lips" },
  { title: "Tư duy Layout & thẩm mỹ", max_score: 10, skill_key: "layout" },
  { title: "Quy trình làm khách thực tế", max_score: 5, skill_key: "process" },
  { title: "Thời gian hoàn thành", max_score: 10, skill_key: "speed", description: "5đ theo thời gian thực hiện (≤60p:5 · 61-65p:4 · 66-70p:3 · 71-75p:2 · 76-80p:1 · >80p hoặc không hoàn thành:0) + 5đ khả năng kiểm soát tiến độ, tổng cộng tối đa 10đ." },
  { title: "Tư duy học nghề & khả năng sửa lỗi", max_score: 5, skill_key: null },
  { title: "Kỷ luật & hồ sơ học tập", max_score: 5, skill_key: "study_record", description: "Đúng giờ, đeo thẻ, hoàn thành bài tập, ghi chép, lưu ảnh/video sản phẩm." }
].map((c, i) => ({ title: c.title, description: c.description ?? "", max_score: c.max_score, position: i, required: true, skill_key: c.skill_key }));

async function seedRubric(category, title, criteria) {
  const existing = await rest(`rubrics?organization_id=eq.${ORG_ID}&category=eq.${category}&select=id`);
  if (existing.length) { console.log(`[skip] rubric "${category}" đã tồn tại (${existing[0].id})`); return; }
  console.log(`[${APPLY ? "apply" : "dry-run"}] tạo rubric "${title}" (${category}) với ${criteria.length} tiêu chí`);
  if (!APPLY) return;
  const rubric = await insertOne("rubrics", { organization_id: ORG_ID, title, description: "", category });
  for (const criterion of criteria) {
    await insertOne("rubric_criteria", { organization_id: ORG_ID, rubric_id: rubric.id, ...criterion });
  }
  console.log(`  -> rubric_id=${rubric.id}`);
}

async function main() {
  await seedRubric("training", "Rubric Training (Makeup & Tóc)", TRAINING_CRITERIA);
  await seedRubric("makeup", "Rubric Thực hành Makeup", MAKEUP_CRITERIA);
  // Hair rubric: deliberately created with zero criteria (spec §E — "Thiết kế rubric bằng cấu
  // hình database... Không hard-code cấu trúc Hair chưa được duyệt"). Admin adds
  // rubric_criteria rows for it later via Supabase once the Hair grading structure is approved.
  await seedRubric("hair", "Rubric Thực hành Tóc", []);
  if (!APPLY) console.log("\nDry run — chạy lại với --apply để ghi dữ liệu thật.");
}

main().catch((error) => { console.error(error); process.exit(1); });
