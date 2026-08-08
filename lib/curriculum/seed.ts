import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import manifestJson from "./six-stage-manifest.json";
import { validateManifest, type CurriculumManifest, type ManifestResource, type SeedReport } from "./types";

// Seeds the ThuyH2O six-stage curriculum into the tables the admin panel already navigates:
// career_stages -> academy_stage_nodes (program/module/group) -> career_stage_resources, with the
// written material in curriculum_documents and catalogued in content_items.
//
// Nothing here writes to a student-facing table. Students see this curriculum because the existing
// resolver reads the same career_stage_resources rows the Stage Workspace edits — configure in
// admin, and the student side follows.
//
// Every step is keyed by the manifest's stable seed keys and is insert-if-missing: re-running finds
// what it made last time and leaves it alone, so an admin who renamed a program or moved a resource
// does not lose that work on the next run.
//
// Batched by design, not by afterthought. The first version checked and inserted one row at a time —
// stage, then program, then module, then group, then document, then catalog entry, then placement —
// which is roughly 430 items and, with a check-then-insert per item, close to 800 sequential
// Supabase round trips for this one manifest. Called from a browser button, that runs past any
// serverless function's execution limit; the request dies mid-run, and the button has no way to know
// that happened. What is here instead: five queries to learn what already exists, everything after
// that decided in memory, and writes issued in chunked batches — a few dozen round trips regardless
// of curriculum size. A CLI run of the unbatched version against production is what actually created
// the current data (see scripts/seed-six-stage-curriculum.mjs's own history); this rewrite is what
// makes the admin button capable of the same thing without a long-running process behind it.

const manifest = manifestJson as unknown as CurriculumManifest;

/** Manifest roles are required/recommended; career_stage_resources speaks required/optional/bonus. */
function toRequirementType(role: string): string {
  return role === "required" ? "required" : "optional";
}

/**
 * All twelve manifest resource kinds are written documents, so they share one resource_type and
 * differ by doc_type. Anything unrecognised falls back to 'article' rather than failing the check
 * constraint at insert time.
 */
const DOC_TYPES = new Set([
  "article", "checklist", "rubric", "practice", "worksheet", "template",
  "assessment", "case_study", "sop", "script", "tool_guide", "playbook", "assignment"
]);
function toDocType(resourceType: string): string {
  return DOC_TYPES.has(resourceType) ? resourceType : "article";
}

type Counter = { created: number; existing: number };
const counter = (): Counter => ({ created: 0, existing: 0 });

const BATCH_SIZE = 50;
function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface SeedOptions {
  organizationId: string;
  actorUserId?: string | null;
  dryRun?: boolean;
}

export async function seedSixStageCurriculum(options: SeedOptions): Promise<SeedReport> {
  const warnings = validateManifest(manifest);
  const report: SeedReport = {
    dryRun: Boolean(options.dryRun),
    organizationId: options.organizationId,
    curriculumKey: manifest.curriculumKey,
    stages: counter(), nodes: counter(), documents: counter(), catalogItems: counter(), placements: counter(),
    warnings
  };
  if (warnings.length) return report;

  if (options.dryRun) {
    // A dry run reports what a real run would find missing, so it has to consult the same existing
    // rows a real run would — otherwise it always reports the whole manifest as new, even on a
    // workspace that already has it.
    const admin = createSupabaseAdminClient();
    if (!admin) { report.warnings.push("SUPABASE_NOT_CONFIGURED"); return report; }
    const existing = await loadExisting(admin, options.organizationId);
    for (const stage of manifest.stages) {
      tallyDryRun(stage.seedKey, existing.stageIds, report.stages);
      for (const program of stage.programs) {
        tallyDryRun(program.key, existing.nodeIds, report.nodes);
        for (const moduleNode of program.modules) {
          tallyDryRun(moduleNode.key, existing.nodeIds, report.nodes);
          for (const group of moduleNode.groups) {
            tallyDryRun(group.key, existing.nodeIds, report.nodes);
            for (const resource of group.resources) {
              const known = existing.docIdByKey.get(resource.key);
              tallyDryRun(resource.key, existing.docIds, report.documents);
              tallyExistence(known ? existing.catalogSourceIds.has(known) : false, report.catalogItems);
              tallyExistence(known ? existing.placedResourceIds.has(known) : false, report.placements);
            }
          }
        }
      }
      if (stage.assignments.length) {
        tallyDryRun(`${stage.seedKey}-assignments`, existing.nodeIds, report.nodes);
        for (const assignment of stage.assignments) {
          const known = existing.docIdByKey.get(assignment.key);
          tallyDryRun(assignment.key, existing.docIds, report.documents);
          tallyExistence(known ? existing.catalogSourceIds.has(known) : false, report.catalogItems);
          tallyExistence(known ? existing.placedResourceIds.has(known) : false, report.placements);
        }
      }
    }
    return report;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) { report.warnings.push("SUPABASE_NOT_CONFIGURED"); return report; }
  const org = options.organizationId;
  const actor = options.actorUserId ?? null;
  const existing = await loadExisting(admin, org);

  // Seeded stages are appended after whatever the organisation already has rather than starting at
  // zero, so a stage an admin created is never silently reordered or pushed off its position.
  const basePosition = existing.maxStagePosition + 1;

  type PendingRow = Record<string, unknown>;
  const stageRows: PendingRow[] = [];
  const programRows: PendingRow[] = [];
  const moduleRows: PendingRow[] = [];
  const groupRows: PendingRow[] = [];
  const documentRows: PendingRow[] = [];
  const catalogRows: PendingRow[] = [];
  const placementRows: PendingRow[] = [];

  // Ids are generated here rather than left to the database default, specifically so a child row
  // (a module naming its program, a placement naming its document) can be built in the same pass as
  // its parent without waiting on a round trip to learn the parent's generated id.
  function resolve(map: Map<string, string>, key: string, tally: Counter, makeRow: (id: string) => PendingRow, push: (row: PendingRow) => void): string {
    const found = map.get(key);
    if (found) { tally.existing += 1; return found; }
    const id = crypto.randomUUID();
    map.set(key, id);
    tally.created += 1;
    push(makeRow(id));
    return id;
  }

  for (const stage of manifest.stages) {
    const stageId = resolve(existing.stageIdByKey, stage.seedKey, report.stages, (id) => ({
      id, organization_id: org, seed_key: stage.seedKey,
      slug: stage.seedKey,
      position: basePosition + Math.max(stage.position - 1, 0),
      index_label: String(stage.position).padStart(2, "0"),
      title: stage.title,
      subtitle: stage.shortTitle ?? null,
      description: stage.description ?? null,
      duration_label: stage.duration ?? null,
      skills: stage.outcomes ?? [],
      status: "active"
    }), (row) => stageRows.push(row));

    for (const [programIndex, program] of stage.programs.entries()) {
      const programId = resolve(existing.nodeIdByKey, program.key, report.nodes, (id) => ({
        id, organization_id: org, seed_key: program.key,
        stage_id: stageId, parent_id: null, node_type: "program",
        title: program.title, position: programIndex, status: "active", surface: program.surface
      }), (row) => programRows.push(row));

      for (const [moduleIndex, moduleNode] of program.modules.entries()) {
        const moduleId = resolve(existing.nodeIdByKey, moduleNode.key, report.nodes, (id) => ({
          id, organization_id: org, seed_key: moduleNode.key,
          stage_id: stageId, parent_id: programId, node_type: "module",
          title: moduleNode.title, position: moduleIndex, status: "active"
        }), (row) => moduleRows.push(row));

        for (const [groupIndex, group] of moduleNode.groups.entries()) {
          const groupId = resolve(existing.nodeIdByKey, group.key, report.nodes, (id) => ({
            id, organization_id: org, seed_key: group.key,
            stage_id: stageId, parent_id: moduleId, node_type: "group",
            title: group.title, position: groupIndex, status: "active"
          }), (row) => groupRows.push(row));

          for (const [resourceIndex, resource] of group.resources.entries()) {
            const documentId = resolveDocument(existing, resource, org, actor, report.documents, (row) => documentRows.push(row));
            resolveCatalogAndPlacement(existing, documentId, stageId, groupId, resourceIndex, toRequirementType(resource.role),
              { title: resource.title, summary: resource.summary ?? "", tags: resource.tags ?? [] }, org, report, catalogRows, placementRows);
          }
        }
      }
    }

    // The manifest gives assignments no home in the program tree and carries only
    // key/title/type/required for each — no brief, no rubric, no pass mark. They are seeded as
    // documents under a per-stage "Bài tập & đánh giá" program with the brief left explicitly
    // unwritten rather than invented.
    if (stage.assignments.length) {
      const assignmentsProgramId = resolve(existing.nodeIdByKey, `${stage.seedKey}-assignments`, report.nodes, (id) => ({
        id, organization_id: org, seed_key: `${stage.seedKey}-assignments`,
        stage_id: stageId, parent_id: null, node_type: "program",
        title: "Bài tập & đánh giá", position: stage.programs.length, status: "active", surface: "create"
      }), (row) => programRows.push(row));

      for (const [index, assignment] of stage.assignments.entries()) {
        const documentId = resolve(existing.docIdByKey, assignment.key, report.documents, (id) => ({
          id, organization_id: org, seed_key: assignment.key,
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
          status: "active",
          created_by: actor
        }), (row) => documentRows.push(row));
        resolveCatalogAndPlacement(existing, documentId, stageId, assignmentsProgramId, index, assignment.required ? "required" : "optional",
          { title: assignment.title, summary: `Bài tập ${assignment.type}`, tags: ["assignment"] }, org, report, catalogRows, placementRows);
      }
    }
  }

  // Nodes are written in three passes by level, not one mixed batch: a group's parent_id names a
  // module that must already be a committed row, and a module's parent_id names a program the same
  // way. Writing programs, then modules, then groups — each pass awaited before the next starts —
  // is what guarantees that without a second round trip to look the parent back up.
  await insertBatches(admin, "career_stages", stageRows, report.warnings);
  await insertBatches(admin, "academy_stage_nodes", programRows, report.warnings);
  await insertBatches(admin, "academy_stage_nodes", moduleRows, report.warnings);
  await insertBatches(admin, "academy_stage_nodes", groupRows, report.warnings);
  await insertBatches(admin, "curriculum_documents", documentRows, report.warnings);
  await insertBatches(admin, "content_items", catalogRows, report.warnings);
  await insertBatches(admin, "career_stage_resources", placementRows, report.warnings);

  return report;
}

interface ExistingRows {
  stageIdByKey: Map<string, string>;
  nodeIdByKey: Map<string, string>;
  docIdByKey: Map<string, string>;
  stageIds: Set<string>;
  nodeIds: Set<string>;
  docIds: Set<string>;
  catalogSourceIds: Set<string>;
  placedResourceIds: Set<string>;
  maxStagePosition: number;
}

/** Everything the seed needs to know about the organisation's current state, in five queries. */
async function loadExisting(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, organizationId: string): Promise<ExistingRows> {
  const [{ data: stageRows }, { data: nodeRows }, { data: docRows }, { data: catalogRows }, { data: placementRows }] = await Promise.all([
    admin.from("career_stages").select("id,seed_key,position").eq("organization_id", organizationId),
    admin.from("academy_stage_nodes").select("id,seed_key").eq("organization_id", organizationId).not("seed_key", "is", null),
    admin.from("curriculum_documents").select("id,seed_key").eq("organization_id", organizationId).not("seed_key", "is", null),
    admin.from("content_items").select("source_id").eq("organization_id", organizationId).eq("source_table", "curriculum_documents"),
    admin.from("career_stage_resources").select("resource_id").eq("organization_id", organizationId).eq("resource_type", "document")
  ]);

  const seededStages = ((stageRows ?? []) as { id: string; seed_key: string | null; position: number }[]).filter((row) => row.seed_key);
  const maxPosition = ((stageRows ?? []) as { position: number }[]).reduce((max, row) => Math.max(max, Number(row.position ?? 0)), -1);

  const stageIdByKey = new Map(seededStages.map((row) => [row.seed_key as string, row.id]));
  const nodeIdByKey = new Map(((nodeRows ?? []) as { id: string; seed_key: string }[]).map((row) => [row.seed_key, row.id]));
  const docIdByKey = new Map(((docRows ?? []) as { id: string; seed_key: string }[]).map((row) => [row.seed_key, row.id]));

  return {
    stageIdByKey, nodeIdByKey, docIdByKey,
    stageIds: new Set(stageIdByKey.keys()),
    nodeIds: new Set(nodeIdByKey.keys()),
    docIds: new Set(docIdByKey.keys()),
    catalogSourceIds: new Set(((catalogRows ?? []) as { source_id: string }[]).map((row) => row.source_id)),
    placedResourceIds: new Set(((placementRows ?? []) as { resource_id: string }[]).map((row) => row.resource_id)),
    maxStagePosition: maxPosition
  };
}

function tallyDryRun(key: string, known: Set<string>, tally: Counter): void {
  if (known.has(key)) tally.existing += 1; else tally.created += 1;
}
function tallyExistence(exists: boolean, tally: Counter): void {
  if (exists) tally.existing += 1; else tally.created += 1;
}

function resolveDocument(
  existing: ExistingRows, resource: ManifestResource, org: string, actor: string | null,
  tally: Counter, push: (row: Record<string, unknown>) => void
): string {
  const found = existing.docIdByKey.get(resource.key);
  if (found) { tally.existing += 1; return found; }
  const id = crypto.randomUUID();
  existing.docIdByKey.set(resource.key, id);
  tally.created += 1;
  push({
    id, organization_id: org, seed_key: resource.key,
    doc_type: toDocType(resource.resourceType),
    title: resource.title,
    summary: resource.summary ?? "",
    body_markdown: resource.bodyMarkdown ?? "",
    tags: resource.tags ?? [],
    status: "active",
    created_by: actor
  });
  return id;
}

function resolveCatalogAndPlacement(
  existing: ExistingRows, documentId: string, stageId: string, nodeId: string, position: number, requirementType: string,
  item: { title: string; summary: string; tags: string[] }, org: string, report: SeedReport,
  catalogRows: Record<string, unknown>[], placementRows: Record<string, unknown>[]
): void {
  if (existing.catalogSourceIds.has(documentId)) { report.catalogItems.existing += 1; } else {
    existing.catalogSourceIds.add(documentId);
    report.catalogItems.created += 1;
    catalogRows.push({
      organization_id: org, content_type: "document", source_table: "curriculum_documents", source_id: documentId,
      title: item.title, summary: item.summary, tags: item.tags, status: "active"
    });
  }
  if (existing.placedResourceIds.has(documentId)) { report.placements.existing += 1; } else {
    existing.placedResourceIds.add(documentId);
    report.placements.created += 1;
    placementRows.push({
      organization_id: org, stage_id: stageId, node_id: nodeId,
      resource_type: "document", resource_id: documentId,
      position, requirement_type: requirementType,
      // Visible and open, as requested for review. surface is left null so each resource inherits it
      // from its program node (migration 0043).
      access: "free_preview", unlock_mode: "immediate", status: "active",
      display_locations: ["library", "journey"]
    });
  }
}

async function insertBatches(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, table: string, rows: Record<string, unknown>[], warnings: string[]): Promise<void> {
  for (const batch of chunks(rows, BATCH_SIZE)) {
    const { error } = await admin.from(table).insert(batch);
    if (error) warnings.push(`${table}: ${error.message}`);
  }
}
