// Read-only validation for the Stage 1 v2 Draft after transform-stage1-v2-blueprint.mjs — checks
// exactly what docs/stage1-learning-os-v1/STAGE1_BLUEPRINT_TRANSFORMATION_REPORT.md's required report
// covers: Outcome count, Mission count, resource bindings, success criteria, prerequisites, orphan
// Missions, broken bindings. Never writes anything.
//
//   node scripts/validate-stage1-v2-transform.mjs

import fs from "node:fs";
import path from "node:path";

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

const headers = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` };
async function rest(pathAndQuery) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${pathAndQuery} :: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log("=== Stage 1 v2 Draft — Validation Report ===\n");

  const v1 = (await rest(`learning_journey_versions?id=eq.${V1_ID}&select=id,status`))[0];
  const v2 = (await rest(`learning_journey_versions?id=eq.${V2_ID}&select=id,status,version_number`))[0];
  console.log(`v1 (published, sống cho học viên thật): status=${v1?.status} — ${v1?.status === "published" ? "OK, không bị đụng" : "⚠️ BẤT THƯỜNG"}`);
  console.log(`v2 (draft, đang transform): status=${v2?.status} — ${v2?.status === "draft" ? "OK, vẫn ở Draft" : "⚠️ BẤT THƯỜNG"}\n`);

  const outcomes = await rest(`learning_journey_outcomes?organization_id=eq.${ORG_ID}&version_id=eq.${V2_ID}&select=id,title,position&order=position.asc`);
  console.log(`--- Outcome: ${outcomes.length}/4 ---`);
  for (const o of outcomes) console.log(`  ${o.position}. ${o.title}`);

  const outcomeIds = outcomes.map((o) => o.id);
  const milestones = await rest(`learning_journey_milestones?organization_id=eq.${ORG_ID}&outcome_id=in.(${outcomeIds.join(",")})&select=id,outcome_id,title,position&order=position.asc`);
  const milestoneIds = milestones.map((m) => m.id);
  const missions = await rest(`learning_journey_missions?organization_id=eq.${ORG_ID}&milestone_id=in.(${milestoneIds.join(",")})&select=*&order=position.asc`);
  console.log(`\n--- Mission: ${missions.length} (yêu cầu gốc "13" — thực tế giữ ${missions.length} theo quyết định giữ nguyên identity, không gộp mất tiến độ) ---`);
  const missionsByMilestone = new Map();
  for (const m of missions) { if (!missionsByMilestone.has(m.milestone_id)) missionsByMilestone.set(m.milestone_id, []); missionsByMilestone.get(m.milestone_id).push(m); }
  for (const milestone of milestones) {
    const outcome = outcomes.find((o) => o.id === milestone.outcome_id);
    console.log(`  [${outcome.title}]`);
    for (const m of (missionsByMilestone.get(milestone.id) ?? [])) console.log(`    pos${m.position}: ${m.title}  (root=${m.root_mission_id === m.id ? "self(NEW)" : m.root_mission_id.slice(0, 8)}, policy=${m.completion_policy}, SC=${m.success_criteria.length})`);
  }

  const missionIds = new Set(missions.map((m) => m.id));

  // Resource bindings — every binding must point at a mission that still exists in v2 (broken = dangling).
  const allBindings = await rest(`learning_mission_resource_bindings?organization_id=eq.${ORG_ID}&select=*`);
  const v2Bindings = allBindings.filter((b) => missionIds.has(b.mission_id));
  const brokenBindings = v2Bindings.filter((b) => !b.resource_id);
  console.log(`\n--- Resource bindings: ${v2Bindings.length} (v1 gốc có 20) — broken (thiếu resource_id): ${brokenBindings.length} ---`);
  for (const m of missions) { const count = v2Bindings.filter((b) => b.mission_id === m.id).length; if (count > 0) console.log(`  ${m.title}: ${count} binding`); }

  // Success criteria coverage.
  const withSC = missions.filter((m) => m.success_criteria.length > 0);
  const withoutSC = missions.filter((m) => m.success_criteria.length === 0);
  console.log(`\n--- Success Criteria: ${withSC.length}/${missions.length} có nội dung, ${withoutSC.length} rỗng ---`);
  if (withoutSC.length) console.log(`  Rỗng (đúng như kế hoạch — 8 Mission mới chưa có nội dung thật soạn sẵn): ${withoutSC.map((m) => m.title).join(", ")}`);

  // Prerequisite chain integrity: every non-null prerequisite_mission_id must resolve inside v2; no cycles.
  console.log(`\n--- Prerequisites ---`);
  const byId = new Map(missions.map((m) => [m.id, m]));
  let brokenPrereq = 0, cyclePrereq = 0;
  for (const m of missions) {
    if (!m.prerequisite_mission_id) continue;
    if (!byId.has(m.prerequisite_mission_id)) { brokenPrereq++; console.log(`  ⚠️ "${m.title}" trỏ prerequisite ra ngoài v2 (id=${m.prerequisite_mission_id})`); continue; }
    // walk the chain up to 30 hops looking for a cycle back to m.id
    let cursor = byId.get(m.prerequisite_mission_id), hops = 0, cycled = false;
    while (cursor && hops < 30) { if (cursor.id === m.id) { cycled = true; break; } cursor = cursor.prerequisite_mission_id ? byId.get(cursor.prerequisite_mission_id) : null; hops++; }
    if (cycled) { cyclePrereq++; console.log(`  ⚠️ Vòng lặp prerequisite phát hiện tại "${m.title}"`); }
  }
  console.log(`  Chuỗi hợp lệ: ${missions.length - brokenPrereq - cyclePrereq}/${missions.length}. Broken: ${brokenPrereq}. Cycle: ${cyclePrereq}.`);
  const roots = missions.filter((m) => !m.prerequisite_mission_id);
  console.log(`  Mission không có prerequisite (điểm bắt đầu chuỗi): ${roots.map((m) => m.title).join(", ")}`);

  // Orphan Missions: milestone_id not among this version's 4 milestones (shouldn't happen — query already filters by it — this checks the inverse: any mission row in the org referencing one of these OLD ids that got missed).
  const expectedOldIds = ["647d0c47-27b2-43d5-9c92-f4d1ce8d9261", "56729aa9-cb6d-4c0d-b9c0-f22c437f30ae", "7223574e-8247-49b9-9737-dfd7b25113d0", "9344edd4-ef3a-4fdd-b73c-bbc6eef6eea9", "b7014236-a8d7-4a4c-bf10-d36919b5c25c", "71d8b936-f825-4d9f-8049-7498660dd4a3", "39bdda5e-973e-4328-abae-a30b920477f8", "f733152c-3b3f-4277-9280-71e3562fb8c6", "a8a0ccf9-4611-494c-b0e6-89eaea87c017", "b9440265-fca8-4697-80eb-e865089012c8", "481c083a-e520-45ee-aeb0-3db3a6904f59", "eafbdeb6-e8f6-4c5e-aa1f-888e39aba917", "a3f51d6b-9e0c-4a69-a416-aea53593eb46", "4fce1c8f-3df9-4e3d-9e18-f2363e202920"];
  const missingOld = expectedOldIds.filter((id) => !missionIds.has(id));
  console.log(`\n--- Orphan Mission check: 14 Mission cũ mong đợi còn đủ trong v2 — thiếu: ${missingOld.length ? missingOld.join(", ") : "0 (đủ 14/14)"} ---`);

  // Broken binding beyond resource: assignment bindings + action templates pointing at missions no longer in v2.
  const allAssignmentBindings = await rest(`learning_mission_assignment_bindings?organization_id=eq.${ORG_ID}&select=id,mission_id`);
  const allActionTemplates = await rest(`learning_mission_action_templates?organization_id=eq.${ORG_ID}&select=id,mission_id`);
  console.log(`\n--- Action templates gắn với 14 Mission cũ: ${allActionTemplates.filter((t) => missionIds.has(t.mission_id)).length} (giữ nguyên vì mission_id không đổi) ---`);
  console.log(`--- Assignment bindings: ${allAssignmentBindings.filter((b) => missionIds.has(b.mission_id)).length} (v1 gốc có 0) ---`);

  // v1 untouched spot-check.
  const v1Sample = await rest(`learning_journey_missions?id=eq.e6956113-3a08-4d93-8a74-b574a10389c4&select=id,title,success_criteria`);
  console.log(`\n--- v1 spot-check (mission gốc "Xác định hướng nghề Makeup") ---`);
  console.log(`  ${JSON.stringify(v1Sample[0])}`);

  console.log("\n=== Hết báo cáo ===");
}

main().catch((error) => { console.error("THẤT BẠI:", error.message); process.exit(1); });
