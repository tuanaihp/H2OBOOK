// Seeds the Learn Outcome OS Journey Blueprint for the real, currently-active Stage 1
// (h2o-stage-01-foundation, "Nền tảng nghề Makeup") from real curriculum content already in
// production. Creates nothing that isn't real: every resource/document binding below resolves to
// an existing career_stage_resources / curriculum_documents row queried live, never invented.
//
// Idempotent the same way lib/learn-outcome/admin.ts's getOrCreateBlueprint is: if a blueprint
// already exists for this stage, this script stops rather than creating a second one.
//
//   node scripts/seed-learn-outcome-stage1.mjs            # dry run, writes nothing
//   node scripts/seed-learn-outcome-stage1.mjs --apply    # writes

import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();

function readEnv(key) {
  const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

const SUPABASE_URL = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const ORG_ID = "4cdbbcbf-d6e1-4d06-bb87-4f63c9cac01f";
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

// Real document ids, pulled live from career_stage_resources for h2o-stage-01-foundation
// (id=37d7584f-00a2-43cd-8406-ca1c76d3038a) — see docs/learn-outcome-os/RELEASE_B_STAGE1_REPORT.md
// for the full query evidence. Keyed by curriculum_documents.seed_key for readability here.
const DOC = {
  "s1-r01": "f3ea479a-8073-4206-ba78-da936f193903", // Tiêu chuẩn vệ sinh và an toàn trong Makeup
  "s1-r02": "448a7a55-2e7b-4cff-b93a-78592a9499c8", // Checklist túi đồ nghề Foundation
  "s1-r03": "109b4dc2-cee3-4ff9-9921-1a7c887e053d", // Quy trình chuẩn bị da trước Makeup
  "s1-r04": "071b2d58-6e2b-4d19-bb28-04c25a293939", // Checklist 8 bước chuẩn bị da
  "s1-r05": "6254a05d-280b-4f73-8638-06d698d05abb", // Nguyên lý lớp nền mỏng, sạch và bền
  "s1-r06": "62edc745-35f1-40a9-b13a-a2bf45f595e1", // Rubric chấm lớp nền Foundation
  "s1-r07": "1171fe5f-efad-4cda-84a4-cb752d4f5036", // Màu sắc cơ bản trong Makeup
  "s1-r08": "5b3dc6fc-a369-4384-87e8-df8c2401b2e4", // Dụng cụ tóc và bảo vệ tóc
  "s1-r09": "f8e0ef3a-2096-49f3-a372-3415897a35f1", // Thực hành sóng & tạo độ phồng cơ bản
  "s1-r10": "a2a48f63-91d4-483b-a5fc-e3788904b9be", // 6 hiểu biết nền tảng khi bắt đầu nghề Makeup
  "s1-r11": "d62b3589-99df-4194-8d60-c4a3af590cbb", // Makeup Career Map
  "s1-r12": "6c8aa029-c2f8-4c3f-8f3b-07b3b5bde62f", // H2O Starter Cost Calculator — hướng dẫn
  "s1-r13": "3cf17845-7b5e-4719-b43c-3bfbc24ebc50", // Checklist thiết lập hồ sơ nghề Makeup
  "s1-r14": "38ce326f-1991-448c-91c3-73878f580cf0", // 30 ý tưởng content cho học viên mới
  "s1-r15": "8e241aff-af72-4b67-8e9d-d60d98f427a6", // Business & Skill Check-up Giai đoạn 1
  "s1-a1": "b18cc4e0-a8c8-459d-88a2-5edaf45a3cf1",  // Hoàn thiện hồ sơ nghề cơ bản
  "s1-a2": "950f6329-3164-4b70-9023-ec88cc32da8e",  // Nộp 3 bài nền cơ bản có Before/After
  "s1-a3": "dc721fbd-eeab-488d-a498-0b686608d96c"   // Hoàn thành Career Map + bảng chi phí
};

// completion_policy mapping: the spec's brief (self_complete/evidence_required/teacher_verify/
// result_required) predates migration 0050's enum, which was written from the source package's
// original CLAUDE_INTEGRATION_PROMPT.md (evidence_required/teacher_verified/metric_based/
// self_reported). Mapped rather than migrating the enum mid-flight: self_complete->self_reported,
// teacher_verify->teacher_verified, result_required->teacher_verified (a capstone mission is a
// review, which is what teacher_verified already models — there is no result-metric to compute
// from for "did you finish your profile").
const OUTCOMES = [
  {
    title: "Hiểu nghề & chọn hướng",
    missions: [
      { title: "Xác định hướng nghề Makeup", expectedResult: "Xác định rõ hướng đi ban đầu trong nghề Makeup và lý do lựa chọn.", completionPolicy: "self_reported", resources: ["s1-r10"], actions: [{ title: "Hoàn thành mission: Xác định hướng nghề Makeup", required: true, evidenceRequired: false }] },
      { title: "Hoàn thành Career Map", expectedResult: "Có Career Map cá nhân và bảng chi phí khởi nghiệp hoàn chỉnh.", completionPolicy: "evidence_required", evidenceType: "document_upload", resources: ["s1-r11", "s1-r12", "s1-a3"], actions: [{ title: "Điền Career Map", required: true, evidenceRequired: false }, { title: "Hoàn thành bảng chi phí khởi nghiệp", required: true, evidenceRequired: false }, { title: "Upload Career Map + bảng chi phí", required: true, evidenceRequired: true }] },
      { title: "Xác định mục tiêu 90 ngày", expectedResult: "Có mục tiêu học tập và thực hành rõ ràng cho 90 ngày đầu.", completionPolicy: "self_reported", resources: [], actions: [{ title: "Viết mục tiêu 90 ngày", required: true, evidenceRequired: false }] }
    ]
  },
  {
    title: "Thiết lập nền tảng nghề",
    missions: [
      { title: "Chuẩn hóa túi đồ nghề", expectedResult: "Túi đồ nghề đạt chuẩn tối thiểu để thực hành an toàn.", completionPolicy: "self_reported", resources: ["s1-r02"], actions: [{ title: "Đối chiếu túi đồ nghề với checklist", required: true, evidenceRequired: false }] },
      { title: "Hoàn thành tiêu chuẩn vệ sinh", expectedResult: "Nắm và áp dụng đúng quy trình vệ sinh, an toàn khi hành nghề.", completionPolicy: "evidence_required", evidenceType: "checklist_confirmation", resources: ["s1-r01"], actions: [{ title: "Thực hành quy trình vệ sinh 1 buổi", required: true, evidenceRequired: true }] },
      { title: "Setup hồ sơ nghề Makeup", expectedResult: "Có hồ sơ nghề Makeup hoàn chỉnh, sẵn sàng giới thiệu với khách/nhà tuyển dụng.", completionPolicy: "evidence_required", evidenceType: "screenshot_upload", resources: ["s1-r13", "s1-r14", "s1-a1"], actions: [
        { title: "Chọn avatar nghề", required: true, evidenceRequired: false },
        { title: "Viết Bio", required: true, evidenceRequired: false },
        { title: "Thêm thông tin liên hệ", required: true, evidenceRequired: false },
        { title: "Tạo album tác phẩm", required: false, evidenceRequired: false },
        { title: "Chụp screenshot hồ sơ hoàn chỉnh", required: true, evidenceRequired: true }
      ] }
    ]
  },
  {
    title: "Xây kỹ thuật nền",
    missions: [
      { title: "Chuẩn bị da đúng", expectedResult: "Thực hiện đúng quy trình chuẩn bị da trước khi trang điểm.", completionPolicy: "evidence_required", evidenceType: "photo_upload", resources: ["s1-r03", "s1-r04"], actions: [{ title: "Thực hành chuẩn bị da theo checklist 8 bước", required: true, evidenceRequired: true }] },
      { title: "Hoàn thiện lớp nền", expectedResult: "Lên lớp nền mỏng, sạch, bền theo đúng nguyên lý và đạt rubric.", completionPolicy: "teacher_verified", evidenceType: "rubric_submission", resources: ["s1-r05", "s1-r06"], actions: [{ title: "Thực hành lớp nền và tự chấm theo rubric", required: true, evidenceRequired: true }] },
      { title: "Màu sắc cơ bản", expectedResult: "Hiểu và áp dụng đúng lý thuyết màu sắc cơ bản trong Makeup.", completionPolicy: "self_reported", resources: ["s1-r07"], actions: [{ title: "Hoàn thành mission: Màu sắc cơ bản", required: true, evidenceRequired: false }] },
      { title: "Tóc nền tảng", expectedResult: "Thực hiện được sóng và độ phồng tóc cơ bản, bảo vệ tóc đúng cách.", completionPolicy: "evidence_required", evidenceType: "photo_upload", resources: ["s1-r08", "s1-r09"], actions: [{ title: "Thực hành sóng & tạo độ phồng cơ bản", required: true, evidenceRequired: true }] }
    ]
  },
  {
    title: "Tạo bằng chứng nghề",
    missions: [
      { title: "Before/After #1", expectedResult: "Có 1 bộ ảnh Before/After đạt chuẩn tối thiểu.", completionPolicy: "teacher_verified", evidenceType: "before_after_photo", resources: ["s1-a2"], actions: [{ title: "Chuẩn bị mẫu", required: true, evidenceRequired: false }, { title: "Thực hiện bài", required: true, evidenceRequired: false }, { title: "Chụp Before", required: true, evidenceRequired: true }, { title: "Chụp After", required: true, evidenceRequired: true }, { title: "Tự chấm", required: true, evidenceRequired: false }, { title: "Upload evidence", required: true, evidenceRequired: true }] },
      { title: "Before/After #2", expectedResult: "Có bộ ảnh Before/After thứ hai, cải thiện so với bài đầu.", completionPolicy: "teacher_verified", evidenceType: "before_after_photo", resources: ["s1-a2"], actions: [{ title: "Chuẩn bị mẫu", required: true, evidenceRequired: false }, { title: "Thực hiện bài", required: true, evidenceRequired: false }, { title: "Chụp Before", required: true, evidenceRequired: true }, { title: "Chụp After", required: true, evidenceRequired: true }, { title: "Tự chấm", required: true, evidenceRequired: false }, { title: "Upload evidence", required: true, evidenceRequired: true }] },
      { title: "Before/After #3", expectedResult: "Có bộ ảnh Before/After thứ ba, đủ điều kiện nộp portfolio Stage 1.", completionPolicy: "teacher_verified", evidenceType: "before_after_photo", resources: ["s1-a2"], actions: [{ title: "Chuẩn bị mẫu", required: true, evidenceRequired: false }, { title: "Thực hiện bài", required: true, evidenceRequired: false }, { title: "Chụp Before", required: true, evidenceRequired: true }, { title: "Chụp After", required: true, evidenceRequired: true }, { title: "Tự chấm", required: true, evidenceRequired: false }, { title: "Upload evidence", required: true, evidenceRequired: true }] },
      { title: "Hoàn thiện hồ sơ Stage 1", expectedResult: "Hồ sơ nghề, Career Map và 3 bộ Before/After sẵn sàng để chuyển sang Stage 2.", completionPolicy: "teacher_verified", evidenceType: "checkup_review", resources: ["s1-r15"], actions: [{ title: "Rà soát toàn bộ hồ sơ Stage 1", required: true, evidenceRequired: false }, { title: "Nộp Business & Skill Check-up", required: true, evidenceRequired: true }] }
    ]
  }
];

const missing = [];
function resolveResourceId(seedKey) {
  const id = DOC[seedKey];
  if (!id) { missing.push(seedKey); return null; }
  return id;
}

async function main() {
  console.log(APPLY ? "CHẾ ĐỘ: GHI THẬT\n" : "CHẾ ĐỘ: CHẠY THỬ (không ghi)\n");

  const stage = (await rest(`career_stages?select=id,title,slug&organization_id=eq.${ORG_ID}&slug=eq.h2o-stage-01-foundation`))[0];
  if (!stage) throw new Error("Không tìm thấy Stage 1 thật (h2o-stage-01-foundation)");
  console.log(`Stage 1 thật: ${stage.title} (${stage.id})`);

  const existingBlueprint = (await rest(`learning_journey_blueprints?select=id&organization_id=eq.${ORG_ID}&stage_id=eq.${stage.id}`))[0];
  if (existingBlueprint) {
    console.log(`Đã có blueprint (${existingBlueprint.id}) cho Stage 1 — script này không tạo bản thứ hai. Dừng.`);
    return;
  }

  let outcomeCount = 0, milestoneCount = 0, missionCount = 0, resourceBindingCount = 0, actionTemplateCount = 0;
  let blueprintId = null, versionId = null;

  if (APPLY) {
    const blueprint = await insertOne("learning_journey_blueprints", { organization_id: ORG_ID, stage_id: stage.id, title: stage.title });
    blueprintId = blueprint.id;
    const version = await insertOne("learning_journey_versions", { organization_id: ORG_ID, blueprint_id: blueprintId, version_number: 1, status: "draft" });
    versionId = version.id;
    console.log(`Blueprint ${blueprintId} / Version ${versionId} (draft)`);
  }

  for (const [outcomeIndex, outcome] of OUTCOMES.entries()) {
    outcomeCount++;
    let outcomeId = null, milestoneId = null;
    if (APPLY) {
      const outcomeRow = await insertOne("learning_journey_outcomes", { organization_id: ORG_ID, version_id: versionId, title: outcome.title, position: outcomeIndex });
      outcomeId = outcomeRow.id;
      const milestoneRow = await insertOne("learning_journey_milestones", { organization_id: ORG_ID, outcome_id: outcomeId, title: outcome.title, position: 0 });
      milestoneId = milestoneRow.id;
    }
    milestoneCount++;

    for (const [missionIndex, mission] of outcome.missions.entries()) {
      missionCount++;
      let missionId = null;
      if (APPLY) {
        const missionRow = await insertOne("learning_journey_missions", {
          organization_id: ORG_ID, milestone_id: milestoneId, title: mission.title, expected_result: mission.expectedResult,
          completion_policy: mission.completionPolicy, position: missionIndex,
          evidence_policy: mission.evidenceType ? { type: mission.evidenceType } : {}
        });
        missionId = missionRow.id;
      }

      for (const [bindingIndex, seedKey] of mission.resources.entries()) {
        const resourceId = resolveResourceId(seedKey);
        if (!resourceId) continue;
        resourceBindingCount++;
        // resource_id here is curriculum_documents.id (career_stage_resources.resource_id for these
        // rows, not career_stage_resources.id itself) — resource_type='document' says so explicitly,
        // and lib/learn-outcome/admin.ts's preflight checks existence against the matching table.
        if (APPLY) await insertOne("learning_mission_resource_bindings", { organization_id: ORG_ID, mission_id: missionId, resource_type: "document", resource_id: resourceId, role: "required", position: bindingIndex });
      }

      for (const [actionIndex, action] of mission.actions.entries()) {
        actionTemplateCount++;
        if (APPLY) await insertOne("learning_mission_action_templates", { organization_id: ORG_ID, mission_id: missionId, title: action.title, required: action.required, evidence_required: action.evidenceRequired, position: actionIndex });
      }

      console.log(`  Mission "${mission.title}" — ${mission.resources.length} resource, ${mission.actions.length} action`);
    }
  }

  console.log("\nTỔNG:");
  console.log(`  Outcome: ${outcomeCount}, Milestone: ${milestoneCount}, Mission: ${missionCount}`);
  console.log(`  Resource bindings: ${resourceBindingCount}, Action templates: ${actionTemplateCount}`);
  if (missing.length) console.log(`\n⚠ MISSING BINDINGS (${missing.length}): ${missing.join(", ")}`);
  if (blueprintId) console.log(`\nblueprintId=${blueprintId}\nversionId=${versionId}`);
}

main().catch((error) => { console.error("THẤT BẠI:", error.message); process.exit(1); });
