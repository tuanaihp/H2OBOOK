// Runs the six-stage curriculum seed against a real database from the command line.
//
// The seed logic itself lives in lib/curriculum/seed.ts and is what the admin button calls. This
// script is the operator's path to the same outcome: it reads .env.local, resolves the organisation,
// and drives the identical insert rules — keyed by the manifest's seed keys, insert-if-missing, so
// running it twice changes nothing the second time.
//
//   node scripts/seed-six-stage-curriculum.mjs            # dry run, writes nothing
//   node scripts/seed-six-stage-curriculum.mjs --apply    # writes
//
// Kept as .mjs rather than importing the TypeScript module because lib/curriculum/seed.ts is
// "server-only" and expects the Next.js request context; duplicating the *rules* here would risk
// drift, so this file deliberately mirrors only the small set of insert shapes and re-reads the same
// manifest JSON as the single source of truth.

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
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/curriculum/six-stage-manifest.json"), "utf8"));

const headers = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };

async function rest(pathAndQuery, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status} ${pathAndQuery} :: ${text.slice(0, 300)}`);
  return body;
}

async function selectOne(table, query) {
  const rows = await rest(`${table}?${query}&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function insertOne(table, row) {
  const rows = await rest(table, { method: "POST", body: JSON.stringify(row), headers: { prefer: "return=representation" } });
  return Array.isArray(rows) ? rows[0] : rows;
}

const DOC_TYPES = new Set(["article", "checklist", "rubric", "practice", "worksheet", "template", "assessment", "case_study", "sop", "script", "tool_guide", "playbook", "assignment"]);
const docType = (kind) => (DOC_TYPES.has(kind) ? kind : "article");
const requirementType = (role) => (role === "required" ? "required" : "optional");

const tally = { stages: { created: 0, existing: 0 }, nodes: { created: 0, existing: 0 }, documents: { created: 0, existing: 0 }, catalog: { created: 0, existing: 0 }, placements: { created: 0, existing: 0 } };
const warnings = [];

async function upsertBySeedKey(table, organizationId, seedKey, insert, counter) {
  const existing = await selectOne(table, `select=id&organization_id=eq.${organizationId}&seed_key=eq.${encodeURIComponent(seedKey)}`);
  if (existing) { counter.existing += 1; return existing.id; }
  if (!APPLY) { counter.created += 1; return `dry-${seedKey}`; }
  try {
    const row = await insertOne(table, { ...insert, organization_id: organizationId, seed_key: seedKey });
    counter.created += 1;
    return row.id;
  } catch (error) {
    warnings.push(`${table}[${seedKey}]: ${error.message}`);
    return null;
  }
}

async function upsertCatalogItem(organizationId, documentId, item) {
  if (!APPLY) { tally.catalog.created += 1; return; }
  const existing = await selectOne("content_items", `select=id&organization_id=eq.${organizationId}&source_table=eq.curriculum_documents&source_id=eq.${documentId}`);
  if (existing) { tally.catalog.existing += 1; return; }
  try {
    await insertOne("content_items", {
      organization_id: organizationId, content_type: "document", source_table: "curriculum_documents", source_id: documentId,
      title: item.title, summary: item.summary, tags: item.tags, status: "active"
    });
    tally.catalog.created += 1;
  } catch (error) { warnings.push(`content_items[${documentId}]: ${error.message}`); }
}

async function upsertPlacement(organizationId, stageId, nodeId, documentId, position, requirement) {
  if (!APPLY) { tally.placements.created += 1; return; }
  const existing = await selectOne("career_stage_resources", `select=id&organization_id=eq.${organizationId}&stage_id=eq.${stageId}&resource_type=eq.document&resource_id=eq.${documentId}`);
  if (existing) { tally.placements.existing += 1; return; }
  try {
    await insertOne("career_stage_resources", {
      organization_id: organizationId, stage_id: stageId, node_id: nodeId,
      resource_type: "document", resource_id: documentId,
      position, requirement_type: requirement,
      // Visible and fully open, as asked for review. surface is left null so each resource inherits
      // it from its program node (migration 0043).
      access: "free_preview", unlock_mode: "immediate", status: "active",
      display_locations: ["library", "journey"]
    });
    tally.placements.created += 1;
  } catch (error) { warnings.push(`placement[${documentId}]: ${error.message}`); }
}

async function main() {
  const org = await selectOne("organizations", "select=id,name&order=created_at.asc");
  if (!org) throw new Error("Không tìm thấy organization nào");
  console.log(`Organization: ${org.name} (${org.id})`);
  console.log(APPLY ? "CHẾ ĐỘ: GHI THẬT\n" : "CHẾ ĐỘ: CHẠY THỬ (không ghi gì)\n");

  // Append after whatever already exists rather than competing for positions the admin's own stages
  // already occupy.
  const last = await selectOne("career_stages", `select=position&organization_id=eq.${org.id}&order=position.desc`);
  const basePosition = Number(last?.position ?? -1) + 1;

  for (const stage of manifest.stages) {
    const stageId = await upsertBySeedKey("career_stages", org.id, stage.seedKey, {
      slug: stage.seedKey,
      position: basePosition + Math.max(stage.position - 1, 0),
      index_label: String(stage.position).padStart(2, "0"),
      title: stage.title,
      subtitle: stage.shortTitle ?? null,
      description: stage.description ?? null,
      duration_label: stage.duration ?? null,
      skills: stage.outcomes ?? [],
      status: "active"
    }, tally.stages);
    if (!stageId) continue;

    for (const [programIndex, program] of stage.programs.entries()) {
      const programId = await upsertBySeedKey("academy_stage_nodes", org.id, program.key, {
        stage_id: stageId, parent_id: null, node_type: "program",
        title: program.title, position: programIndex, status: "active", surface: program.surface
      }, tally.nodes);
      if (!programId) continue;

      for (const [moduleIndex, moduleNode] of program.modules.entries()) {
        const moduleId = await upsertBySeedKey("academy_stage_nodes", org.id, moduleNode.key, {
          stage_id: stageId, parent_id: programId, node_type: "module",
          title: moduleNode.title, position: moduleIndex, status: "active"
        }, tally.nodes);
        if (!moduleId) continue;

        for (const [groupIndex, group] of moduleNode.groups.entries()) {
          const groupId = await upsertBySeedKey("academy_stage_nodes", org.id, group.key, {
            stage_id: stageId, parent_id: moduleId, node_type: "group",
            title: group.title, position: groupIndex, status: "active"
          }, tally.nodes);
          if (!groupId) continue;

          for (const [resourceIndex, resource] of group.resources.entries()) {
            const documentId = await upsertBySeedKey("curriculum_documents", org.id, resource.key, {
              doc_type: docType(resource.resourceType),
              title: resource.title,
              summary: resource.summary ?? "",
              body_markdown: resource.bodyMarkdown ?? "",
              tags: resource.tags ?? [],
              status: "active"
            }, tally.documents);
            if (!documentId) continue;
            await upsertCatalogItem(org.id, documentId, { title: resource.title, summary: resource.summary ?? "", tags: resource.tags ?? [] });
            await upsertPlacement(org.id, stageId, groupId, documentId, resourceIndex, requirementType(resource.role));
          }
        }
      }
    }

    // The manifest gives assignments no home in the program tree and carries only
    // key/title/type/required for each, so they land under a per-stage program of their own with the
    // brief left explicitly unwritten rather than invented.
    if (stage.assignments?.length) {
      const assignmentsProgramId = await upsertBySeedKey("academy_stage_nodes", org.id, `${stage.seedKey}-assignments`, {
        stage_id: stageId, parent_id: null, node_type: "program",
        title: "Bài tập & đánh giá", position: stage.programs.length, status: "active", surface: "create"
      }, tally.nodes);
      if (assignmentsProgramId) {
        for (const [index, assignment] of stage.assignments.entries()) {
          const documentId = await upsertBySeedKey("curriculum_documents", org.id, assignment.key, {
            doc_type: "assignment",
            title: assignment.title,
            summary: `Bài tập dạng ${assignment.type}${assignment.required ? " — bắt buộc" : " — tùy chọn"}`,
            body_markdown: [
              `# ${assignment.title}`, "",
              `- Dạng bài: ${assignment.type}`,
              `- Mức độ: ${assignment.required ? "Bắt buộc" : "Tùy chọn"}`, "",
              "## Đề bài", "_Chưa có nội dung — cần biên soạn._", "",
              "## Tiêu chí đạt", "_Chưa có tiêu chí chấm — cần biên soạn._"
            ].join("\n"),
            tags: ["assignment", assignment.type],
            status: "active"
          }, tally.documents);
          if (!documentId) continue;
          await upsertCatalogItem(org.id, documentId, { title: assignment.title, summary: `Bài tập ${assignment.type}`, tags: ["assignment"] });
          await upsertPlacement(org.id, stageId, assignmentsProgramId, documentId, index, assignment.required ? "required" : "optional");
        }
      }
    }
    process.stdout.write(`  ✓ ${stage.title}\n`);
  }

  console.log("\nKẾT QUẢ (tạo mới / đã có sẵn):");
  for (const [name, value] of Object.entries(tally)) console.log(`  ${name.padEnd(12)} ${String(value.created).padStart(4)} / ${value.existing}`);
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} cảnh báo:`);
    warnings.slice(0, 20).forEach((warning) => console.log("  " + warning));
  } else {
    console.log("\nKhông có lỗi.");
  }
}

main().catch((error) => { console.error("THẤT BẠI:", error.message); process.exit(1); });
