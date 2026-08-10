// Clones the published Stage 1 Journey v1 into a new draft v2, then applies the estimated-days +
// success-KPI enrichment from v5/29-H2OBOOK_JOURNEY_MAP_V2_SMART_UPGRADE/data/stage1-v2-enrichment.json.
// v1 itself is never touched — this only ever writes new rows plus updates within the new v2 rows.
//
// Mirrors lib/learn-outcome/admin.ts's duplicateVersion() exactly (same copy order, same
// prerequisite remap via an old-id -> new-id map) since that function needs a request-scoped
// session this script doesn't have; the logic is identical, just issued directly over REST with the
// service role key, same convention as scripts/seed-learn-outcome-stage1.mjs.
//
//   node scripts/clone-journey-stage1-v2.mjs            # dry run: prints the match report only
//   node scripts/clone-journey-stage1-v2.mjs --apply    # clones + enriches for real

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
const BLUEPRINT_ID = "65c02e83-5cda-4bcd-9202-fe5bbd71bba4";
const V1_ID = "867f149d-c6ae-466f-9536-c8c2e37817bc";

const headers = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
async function rest(pathAndQuery, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status} ${pathAndQuery} :: ${text.slice(0, 400)}`);
  return body;
}
const insertOne = async (table, row) => (await rest(table, { method: "POST", body: JSON.stringify(row), headers: { prefer: "return=representation" } }))[0];

const enrichment = JSON.parse(fs.readFileSync(path.join(ROOT, "..", "v5", "29-H2OBOOK_JOURNEY_MAP_V2_SMART_UPGRADE", "data", "stage1-v2-enrichment.json"), "utf8"));

async function main() {
  console.log(APPLY ? "CHẾ ĐỘ: GHI THẬT\n" : "CHẾ ĐỘ: CHẠY THỬ (chỉ in match report)\n");

  // Load v1's full graph.
  const outcomes = await rest(`learning_journey_outcomes?select=id,title,description,position&organization_id=eq.${ORG_ID}&version_id=eq.${V1_ID}&order=position.asc`);
  const outcomeIds = outcomes.map((o) => o.id);
  const milestones = await rest(`learning_journey_milestones?select=id,outcome_id,title,description,position&organization_id=eq.${ORG_ID}&outcome_id=in.(${outcomeIds.join(",")})&order=position.asc`);
  const milestoneIds = milestones.map((m) => m.id);
  const missions = await rest(`learning_journey_missions?select=*&organization_id=eq.${ORG_ID}&milestone_id=in.(${milestoneIds.join(",")})&order=position.asc`);
  const missionIds = missions.map((m) => m.id);
  const [resourceBindings, toolBindings, assignmentBindings, actionTemplates] = await Promise.all([
    rest(`learning_mission_resource_bindings?select=*&organization_id=eq.${ORG_ID}`).then((r) => r.filter((b) => missionIds.includes(b.mission_id))),
    rest(`learning_mission_tool_bindings?select=*&organization_id=eq.${ORG_ID}`).then((r) => r.filter((b) => missionIds.includes(b.mission_id))),
    rest(`learning_mission_assignment_bindings?select=*&organization_id=eq.${ORG_ID}`).then((r) => r.filter((b) => missionIds.includes(b.mission_id))),
    rest(`learning_mission_action_templates?select=*&organization_id=eq.${ORG_ID}`).then((r) => r.filter((t) => missionIds.includes(t.mission_id)))
  ]);
  console.log(`v1: ${outcomes.length} outcome, ${milestones.length} milestone, ${missions.length} mission, ${resourceBindings.length} resource binding, ${actionTemplates.length} action template`);

  // Match report — title match against the enrichment file, before touching anything.
  const missionsByTitle = new Map(missions.map((m) => [m.title.trim(), m]));
  const matched = [], missing = [], ambiguous = [];
  const titleCounts = new Map();
  for (const m of missions) titleCounts.set(m.title.trim(), (titleCounts.get(m.title.trim()) ?? 0) + 1);
  for (const item of enrichment.missionEnrichment) {
    const count = titleCounts.get(item.title.trim()) ?? 0;
    if (count === 0) missing.push(item.title);
    else if (count > 1) ambiguous.push(item.title);
    else matched.push(item.title);
  }
  console.log(`\nMatch report: matched=${matched.length}, missing=${missing.length}, ambiguous=${ambiguous.length}`);
  if (missing.length) console.log("  MISSING:", missing.join(", "));
  if (ambiguous.length) console.log("  AMBIGUOUS:", ambiguous.join(", "));
  if (ambiguous.length > 0) { console.log("\nDỪNG — có mission trùng tên (ambiguous). Không áp dụng gì."); return; }
  if (!APPLY) { console.log("\n(Chạy thử xong — dùng --apply để thực sự clone + enrich.)"); return; }

  // Clone: version v2.
  const newVersion = await insertOne("learning_journey_versions", { organization_id: ORG_ID, blueprint_id: BLUEPRINT_ID, version_number: 2, status: "draft" });
  console.log(`\nĐã tạo Version v2 (draft): ${newVersion.id}`);

  const missionIdMap = new Map();
  const newMissionRows = [];
  for (const outcome of outcomes) {
    const newOutcome = await insertOne("learning_journey_outcomes", { organization_id: ORG_ID, version_id: newVersion.id, title: outcome.title, description: outcome.description, position: outcome.position });
    const outcomeMilestones = milestones.filter((m) => m.outcome_id === outcome.id);
    for (const milestone of outcomeMilestones) {
      const newMilestone = await insertOne("learning_journey_milestones", { organization_id: ORG_ID, outcome_id: newOutcome.id, title: milestone.title, description: milestone.description, position: milestone.position });
      const milestoneMissions = missions.filter((m) => m.milestone_id === milestone.id);
      for (const mission of milestoneMissions) {
        const newMission = await insertOne("learning_journey_missions", {
          organization_id: ORG_ID, milestone_id: newMilestone.id, title: mission.title, description: mission.description,
          expected_result: mission.expected_result, estimated_days: mission.estimated_days, completion_policy: mission.completion_policy,
          success_criteria: mission.success_criteria, evidence_policy: mission.evidence_policy, position: mission.position
        });
        missionIdMap.set(mission.id, newMission.id);
        newMissionRows.push({ oldId: mission.id, newId: newMission.id, title: mission.title });

        for (const b of resourceBindings.filter((x) => x.mission_id === mission.id)) await insertOne("learning_mission_resource_bindings", { organization_id: ORG_ID, mission_id: newMission.id, resource_type: b.resource_type, resource_id: b.resource_id, role: b.role, position: b.position });
        for (const b of toolBindings.filter((x) => x.mission_id === mission.id)) await insertOne("learning_mission_tool_bindings", { organization_id: ORG_ID, mission_id: newMission.id, tool_type: b.tool_type, tool_id: b.tool_id, role: b.role, position: b.position });
        for (const b of assignmentBindings.filter((x) => x.mission_id === mission.id)) await insertOne("learning_mission_assignment_bindings", { organization_id: ORG_ID, mission_id: newMission.id, assignment_id: b.assignment_id, role: b.role, position: b.position });
        for (const t of actionTemplates.filter((x) => x.mission_id === mission.id)) await insertOne("learning_mission_action_templates", { organization_id: ORG_ID, mission_id: newMission.id, title: t.title, description: t.description, required: t.required, day_offset: t.day_offset, evidence_required: t.evidence_required, position: t.position });
      }
    }
  }

  // Remap prerequisite_mission_id through the old->new map.
  for (const mission of missions) {
    if (!mission.prerequisite_mission_id) continue;
    const newId = missionIdMap.get(mission.id);
    const newPrereqId = missionIdMap.get(mission.prerequisite_mission_id);
    if (newId && newPrereqId) await rest(`learning_journey_missions?id=eq.${newId}`, { method: "PATCH", body: JSON.stringify({ prerequisite_mission_id: newPrereqId }) });
  }
  console.log(`Đã copy ${newMissionRows.length} mission + toàn bộ binding/action template, remap prerequisite xong.`);

  // Apply enrichment by resolved mission id (never by title again past this point).
  let enrichedCount = 0;
  for (const item of enrichment.missionEnrichment) {
    const oldMission = missionsByTitle.get(item.title.trim());
    if (!oldMission) continue;
    const newId = missionIdMap.get(oldMission.id);
    await rest(`learning_journey_missions?id=eq.${newId}`, { method: "PATCH", body: JSON.stringify({ estimated_days: item.estimatedDays, success_criteria: item.successCriteria }) });
    enrichedCount++;
  }
  console.log(`Đã enrich ${enrichedCount}/${enrichment.missionEnrichment.length} mission (estimated_days + success_criteria) trong v2.`);
  console.log(`\nv2 versionId=${newVersion.id} — vẫn ở trạng thái draft, CHƯA publish.`);
}

main().catch((error) => { console.error("THẤT BẠI:", error.message); process.exit(1); });
