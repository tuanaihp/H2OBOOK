// Stage 1 Blueprint Transformation — reshapes the v2 DRAFT (created by
// apply-stage1-success-criteria-v2.mjs) into the 4-Outcome/22-Mission structure requested in
// docs/stage1-learning-os-v1/STAGE1_BLUEPRINT_TRANSFORMATION_REPORT.md. v1 (published, live for 2 real
// students) is never touched — this script only ever operates on version_id = V2_ID.
//
// Core principle (explicit user instruction): NOT "delete 14 old Missions -> create 13 new ones".
// Every old Mission's identity (id, root_mission_id, resource/assignment bindings, workspace configs)
// is preserved by UPDATING its title/milestone_id/position/prerequisite_mission_id IN PLACE — mission
// ids never change, so every existing learning_mission_resource_bindings row stays correctly attached
// with zero rewiring. Only genuinely new concepts (no old Mission covers the same idea) get INSERTed
// as new missions with root_mission_id = their own new id.
//
// The requested blueprint has only 3 "slots" in Outcome 03/04 (Giáo trình Makeup, Skill Passport &
// Practice Lab, Portfolio Evidence) for what are 7 real, distinct, independently-progressed Missions
// today (4 technique + 3 Before/After). Forcing a 7-into-3 merge would mean picking 1 survivor per
// slot and discarding real per-Mission identity/progress for the other 6 — this is exactly the
// "delete then recreate" failure mode called out. User confirmed (2026-08-12): keep all 7 as distinct
// Missions, exceed the literal count of 13, and report the real total honestly. Final total: 22
// Missions (14 old, all preserved, + 8 new).
//
//   node scripts/transform-stage1-v2-blueprint.mjs            # dry run: prints the full plan only
//   node scripts/transform-stage1-v2-blueprint.mjs --apply    # writes for real, v2 draft only

import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();
function readEnv(key) {
  const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  return (text.match(new RegExp(`^${key}=(.*)$`, "m")) || [])[1]?.trim() ?? "";
}
const SUPABASE_URL = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const ORG_ID = "4cdbbcbf-d6e1-4d06-bb87-4f63c9cac01f";
const V1_ID = "867f149d-c6ae-466f-9536-c8c2e37817bc";
const V2_ID = "5f63920f-23de-4e1d-b3eb-4de5e766c237";

const headers = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
async function rest(pathAndQuery, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status} ${pathAndQuery} :: ${text.slice(0, 400)}`);
  return body;
}
const insertOne = async (table, row) => (await rest(table, { method: "POST", body: JSON.stringify(row), headers: { prefer: "return=representation" } }))[0];
const patchOne = async (table, id, patch) => rest(`${table}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });

// --- Fixed v2 ids from the previous script run (apply-stage1-success-criteria-v2.mjs), re-verified live below ---
const OUTCOME = {
  o1: "64f4fc15-da85-4c63-9469-d4cf41861253", o2: "21fac127-6d11-48c5-89bd-72fc5aa70764",
  o3: "10c8656d-310b-4cef-a01a-5da687acb522", o4: "4b2aeae4-20ae-41d9-9ef0-21ca6e2b3e8f"
};
const MILESTONE = {
  m1: "adb822bd-605c-4238-befe-09a9e6f38f3c", m2: "1597ce6c-1b3c-4676-958b-9dcfc16c4364",
  m3: "2460a2eb-335d-411c-abec-bb6f7b2519e7", m4: "f0260e30-fa65-4af9-87d7-563f2a64780f"
};
const MISSION = {
  huongNghe: "647d0c47-27b2-43d5-9c92-f4d1ce8d9261", careerMap: "b7014236-a8d7-4a4c-bf10-d36919b5c25c", ninetyDay: "b9440265-fca8-4697-80eb-e865089012c8",
  setupHoSo: "a8a0ccf9-4611-494c-b0e6-89eaea87c017", tuiDoNghe: "9344edd4-ef3a-4fdd-b73c-bbc6eef6eea9", veSinh: "39bdda5e-973e-4328-abae-a30b920477f8",
  chuanBiDa: "7223574e-8247-49b9-9737-dfd7b25113d0", lopNen: "f733152c-3b3f-4277-9280-71e3562fb8c6", mauSac: "eafbdeb6-e8f6-4c5e-aa1f-888e39aba917", tocNenTang: "a3f51d6b-9e0c-4a69-a416-aea53593eb46",
  ba1: "56729aa9-cb6d-4c0d-b9c0-f22c437f30ae", ba2: "71d8b936-f825-4d9f-8049-7498660dd4a3", ba3: "481c083a-e520-45ee-aeb0-3db3a6904f59", hoanThienStage1: "4fce1c8f-3df9-4e3d-9e18-f2363e202920"
};

const OUTCOME_RENAMES = [
  { id: OUTCOME.o1, from: "Hiểu nghề & chọn hướng", to: "Định hướng nghề & Career Map" },
  { id: OUTCOME.o2, from: "Thiết lập nền tảng nghề", to: "Xây hệ thống nghề cá nhân" },
  { id: OUTCOME.o3, from: "Xây kỹ thuật nền", to: "Học & làm chủ kỹ thuật" },
  { id: OUTCOME.o4, from: "Tạo bằng chứng nghề", to: "Tốt nghiệp & Chứng nhận năng lực" }
];
const MILESTONE_RENAMES = [
  { id: MILESTONE.m1, to: "Định hướng nghề & Career Map" }, { id: MILESTONE.m2, to: "Xây hệ thống nghề cá nhân" },
  { id: MILESTONE.m3, to: "Học & làm chủ kỹ thuật" }, { id: MILESTONE.m4, to: "Tốt nghiệp & Chứng nhận năng lực" }
];

// action: "keep" (no field changes besides position/prereq), "rename", "move" (milestone change, title kept)
const EXISTING_MISSION_PLAN = [
  { id: MISSION.huongNghe, action: "keep", milestoneId: MILESTONE.m1, position: 0 },
  { id: MISSION.careerMap, action: "rename", title: "Hoàn thành Makeup Career Map", milestoneId: MILESTONE.m1, position: 1 },
  { id: MISSION.ninetyDay, action: "rename", title: "Lộ trình Makeup 90 ngày của tôi", milestoneId: MILESTONE.m1, position: 2 },
  { id: MISSION.setupHoSo, action: "rename", title: "Hồ sơ nghề Makeup", milestoneId: MILESTONE.m2, position: 2 },
  { id: MISSION.tuiDoNghe, action: "move", milestoneId: MILESTONE.m3, position: 1 },
  { id: MISSION.veSinh, action: "move", milestoneId: MILESTONE.m3, position: 2 },
  { id: MISSION.chuanBiDa, action: "keep", milestoneId: MILESTONE.m3, position: 3 },
  { id: MISSION.lopNen, action: "keep", milestoneId: MILESTONE.m3, position: 4 },
  { id: MISSION.mauSac, action: "keep", milestoneId: MILESTONE.m3, position: 5 },
  { id: MISSION.tocNenTang, action: "keep", milestoneId: MILESTONE.m3, position: 6 },
  { id: MISSION.ba1, action: "keep", milestoneId: MILESTONE.m4, position: 0 },
  { id: MISSION.ba2, action: "keep", milestoneId: MILESTONE.m4, position: 1 },
  { id: MISSION.ba3, action: "keep", milestoneId: MILESTONE.m4, position: 2 },
  { id: MISSION.hoanThienStage1, action: "rename", title: "Đánh giá cuối khóa", milestoneId: MILESTONE.m4, position: 4 }
];

// New missions: key used to resolve cross-references (prerequisiteKey) after insertion. root_mission_id is
// its own new id (first-generation identity, migration 0054 semantics) — never invented against an old mission.
const NEW_MISSIONS = [
  { key: "styleDna", title: "Makeup Style DNA", milestoneId: MILESTONE.m2, position: 0,
    expectedResult: "Xác định phong cách trang điểm cá nhân (Style DNA): điểm mạnh, gu thẩm mỹ và hướng phát triển riêng.",
    completionPolicy: "self_reported", evidencePolicy: {}, prerequisiteKey: "existing:ninetyDay" },
  { key: "brand", title: "Sáng tạo Makeup Brand", milestoneId: MILESTONE.m2, position: 1,
    expectedResult: "Xây dựng Brand Kit cá nhân cho dịch vụ Makeup (tên thương hiệu, màu sắc, thông điệp).",
    completionPolicy: "evidence_required", evidencePolicy: { type: "document_upload" }, prerequisiteKey: "new:styleDna" },
  { key: "giaoTrinh", title: "Giáo trình Makeup", milestoneId: MILESTONE.m3, position: 0,
    expectedResult: "Đã xem qua đầy đủ giáo trình kỹ thuật nền Stage 1 (chuẩn bị da, lớp nền, màu sắc, tóc).",
    completionPolicy: "self_reported", evidencePolicy: {}, prerequisiteKey: "existing:setupHoSo" },
  { key: "video", title: "Khóa học Video", milestoneId: MILESTONE.m3, position: 7,
    expectedResult: "Đã xem các video hướng dẫn kỹ thuật liên quan Stage 1.",
    completionPolicy: "self_reported", evidencePolicy: {}, prerequisiteKey: "existing:tocNenTang" },
  { key: "skillPassport", title: "Skill Passport & Practice Lab", milestoneId: MILESTONE.m3, position: 8,
    expectedResult: "Xem lại Skill Passport (mastery % theo từng kỹ năng) và luyện tập bổ sung nếu cần.",
    completionPolicy: "self_reported", evidencePolicy: {}, prerequisiteKey: "new:video" },
  { key: "portfolio", title: "Portfolio Evidence", milestoneId: MILESTONE.m4, position: 3,
    expectedResult: "Tổng hợp đủ 3 bộ ảnh Before/After đạt chuẩn thành 1 bộ Portfolio hoàn chỉnh.",
    completionPolicy: "evidence_required", evidencePolicy: { type: "document_upload" }, prerequisiteKey: "existing:ba3" },
  { key: "careerPassport", title: "Career Passport", milestoneId: MILESTONE.m4, position: 5,
    expectedResult: "Rà soát lại Career Passport (định hướng nghề, Career Map, mục tiêu 90 ngày) trước khi xét chứng nhận.",
    completionPolicy: "self_reported", evidencePolicy: {}, prerequisiteKey: "existing:hoanThienStage1" },
  { key: "chungNhan", title: "Chứng nhận hoàn thành", milestoneId: MILESTONE.m4, position: 6,
    expectedResult: "Nhận Chứng nhận hoàn thành Stage 1 sau khi giáo viên xác nhận đủ điều kiện.",
    completionPolicy: "teacher_verified", evidencePolicy: {}, prerequisiteKey: "new:careerPassport" }
];

// Final prerequisite chain — every mission (old or new) gets exactly this prerequisite once all ids are known.
// existing:<key> resolves to MISSION[key] (unchanged id); new:<key> resolves to the freshly inserted mission's id.
const PREREQUISITE_PLAN = [
  { id: MISSION.careerMap, prereq: "existing:huongNghe" },
  { id: MISSION.ninetyDay, prereq: "existing:careerMap" },
  // new:styleDna prereq existing:ninetyDay (set at insert time)
  // new:brand prereq new:styleDna (set at insert time)
  { id: MISSION.setupHoSo, prereq: "new:brand" },
  // new:giaoTrinh prereq existing:setupHoSo (set at insert time)
  { id: MISSION.tuiDoNghe, prereq: "new:giaoTrinh" },
  { id: MISSION.veSinh, prereq: "existing:tuiDoNghe" },
  { id: MISSION.chuanBiDa, prereq: "existing:veSinh" },
  { id: MISSION.lopNen, prereq: "existing:chuanBiDa" },
  { id: MISSION.mauSac, prereq: "existing:lopNen" },
  { id: MISSION.tocNenTang, prereq: "existing:mauSac" },
  // new:video prereq existing:tocNenTang (set at insert time)
  // new:skillPassport prereq new:video (set at insert time)
  { id: MISSION.ba1, prereq: "new:skillPassport" },
  { id: MISSION.ba2, prereq: "existing:ba1" },
  { id: MISSION.ba3, prereq: "existing:ba2" },
  // new:portfolio prereq existing:ba3 (set at insert time)
  { id: MISSION.hoanThienStage1, prereq: "new:portfolio" }
  // new:careerPassport prereq existing:hoanThienStage1 (set at insert time)
  // new:chungNhan prereq new:careerPassport (set at insert time)
];

async function main() {
  console.log(APPLY ? "CHẾ ĐỘ: GHI THẬT (v2 Draft only)\n" : "CHẾ ĐỘ: CHẠY THỬ (chỉ in kế hoạch)\n");

  // Safety: confirm v1 untouched-eligible state and v2 is still the exact draft we expect.
  const v1 = await rest(`learning_journey_versions?id=eq.${V1_ID}&select=id,status`);
  if (!v1.length || v1[0].status !== "published") { console.log("DỪNG — v1 không còn ở trạng thái published như audit trước. Không làm gì."); return; }
  const v2 = await rest(`learning_journey_versions?id=eq.${V2_ID}&select=id,status,version_number`);
  if (!v2.length || v2[0].status !== "draft") { console.log("DỪNG — v2 không còn ở trạng thái draft (có thể đã bị publish/xóa). Không làm gì."); return; }

  const currentMissions = await rest(`learning_journey_missions?organization_id=eq.${ORG_ID}&milestone_id=in.(${Object.values(MILESTONE).join(",")})&select=id,title,milestone_id`);
  const currentById = new Map(currentMissions.map((m) => [m.id, m]));
  const missing = Object.entries(MISSION).filter(([, id]) => !currentById.has(id));
  if (missing.length) { console.log("DỪNG — cấu trúc v2 đã đổi khác lúc audit, thiếu mission:", missing.map(([k]) => k).join(", ")); return; }
  console.log(`Xác nhận v2 (draft, v${v2[0].version_number}) khớp đúng 14 mission đã audit. Bắt đầu kế hoạch transform.\n`);

  console.log("--- Outcome renames ---");
  for (const o of OUTCOME_RENAMES) console.log(`  "${o.from}" -> "${o.to}"`);
  console.log("--- Milestone renames (mirror outcome) ---");
  for (const m of MILESTONE_RENAMES) console.log(`  ${m.id} -> "${m.to}"`);
  console.log(`\n--- 14 Mission cũ: giữ id/root_mission_id/binding, chỉ đổi title/milestone/position/prerequisite ---`);
  for (const m of EXISTING_MISSION_PLAN) console.log(`  [${m.action}] ${currentById.get(m.id).title}${m.title ? ` -> "${m.title}"` : ""} (milestone=${m.milestoneId === currentById.get(m.id).milestone_id ? "unchanged" : "MOVED"}, position=${m.position})`);
  console.log(`\n--- 8 Mission mới (root_mission_id = chính nó) ---`);
  for (const m of NEW_MISSIONS) console.log(`  [NEW] "${m.title}" (milestone=${m.milestoneId}, position=${m.position}, policy=${m.completionPolicy})`);
  console.log(`\nTổng sau transform: 14 (cũ, giữ nguyên identity) + 8 (mới) = 22 mission — KHÔNG ép về đúng 13 (theo quyết định người dùng 2026-08-12: giữ toàn bộ Mission thật riêng biệt, không gộp mất identity/tiến độ).`);

  if (!APPLY) { console.log("\n(Chạy thử xong — dùng --apply để ghi thật vào v2 Draft. v1 published không bao giờ bị đụng tới.)"); return; }

  // 1) Rename outcomes + milestones.
  for (const o of OUTCOME_RENAMES) await patchOne("learning_journey_outcomes", o.id, { title: o.to });
  for (const m of MILESTONE_RENAMES) await patchOne("learning_journey_milestones", m.id, { title: m.to });
  console.log("Đã đổi tên 4 Outcome + 4 Milestone.");

  // 2) Update the 14 existing missions: title (if renamed), milestone_id (if moved), position. Prerequisite set in a later pass.
  for (const m of EXISTING_MISSION_PLAN) {
    const patch = { milestone_id: m.milestoneId, position: m.position };
    if (m.action === "rename") patch.title = m.title;
    await patchOne("learning_journey_missions", m.id, patch);
  }
  console.log(`Đã cập nhật title/milestone/position cho ${EXISTING_MISSION_PLAN.length} mission cũ (giữ nguyên id/root_mission_id/binding).`);

  // 3) Insert the 8 new missions in dependency order (so "new:X" prerequisite refs resolve as we go).
  const newIds = {};
  function resolveRef(ref) {
    if (ref.startsWith("existing:")) return MISSION[ref.slice("existing:".length)];
    if (ref.startsWith("new:")) return newIds[ref.slice("new:".length)];
    throw new Error(`Unresolvable prerequisite ref: ${ref}`);
  }
  for (const m of NEW_MISSIONS) {
    const inserted = await insertOne("learning_journey_missions", {
      organization_id: ORG_ID, milestone_id: m.milestoneId, title: m.title, description: null,
      expected_result: m.expectedResult, estimated_days: null, completion_policy: m.completionPolicy,
      success_criteria: [], evidence_policy: m.evidencePolicy, position: m.position,
      prerequisite_mission_id: resolveRef(m.prerequisiteKey)
    });
    newIds[m.key] = inserted.id;
    await patchOne("learning_journey_missions", inserted.id, { root_mission_id: inserted.id });
    console.log(`  Đã tạo mới "${m.title}" (id=${inserted.id})`);
  }

  // 4) Prerequisite pass for the 14 existing missions (some now point at new mission ids).
  for (const p of PREREQUISITE_PLAN) await patchOne("learning_journey_missions", p.id, { prerequisite_mission_id: resolveRef(p.prereq) });
  console.log(`Đã cập nhật prerequisite_mission_id cho ${PREREQUISITE_PLAN.length} mission cũ.`);

  console.log(`\nHoàn tất transform trên v2 Draft (${V2_ID}). v1 Published (${V1_ID}) không bị đụng tới. Chạy scripts/validate-stage1-v2-transform.mjs để kiểm tra lại toàn bộ.`);
}

main().catch((error) => { console.error("THẤT BẠI:", error.message); process.exit(1); });
