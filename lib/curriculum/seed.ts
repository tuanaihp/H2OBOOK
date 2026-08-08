import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import manifestJson from "./six-stage-manifest.json";
import { validateManifest, type CurriculumManifest, type ManifestResource, type SeedReport, type SeedTally } from "./types";

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
// does not lose that work on the next run. "Leaves it alone" has one deliberate exception — status.
// Archiving a stage or a resource is a soft delete, not a removal, and an admin who archived the
// whole curriculum and then clicked "Nạp vào workspace" again is asking for it back, not confirming
// it should stay invisible. A found-but-archived row is reactivated; nothing else about it is
// touched.
//
// Batched by design, not by afterthought. The first version checked and inserted one row at a time —
// stage, then program, then module, then group, then document, then catalog entry, then placement —
// which is roughly 430 items and, with a check-then-insert per item, close to 800 sequential
// Supabase round trips for this one manifest. Called from a browser button, that runs past any
// serverless function's execution limit; the request dies mid-run, and the button has no way to know
// that happened. What is here instead: five queries to learn what already exists, everything after
// that decided in memory, and writes issued in chunked batches — a few dozen round trips regardless
// of curriculum size.

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

const tally = (): SeedTally => ({ created: 0, existing: 0, revived: 0 });

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
    stages: tally(), nodes: tally(), documents: tally(), catalogItems: tally(), placements: tally(),
    warnings
  };
  if (warnings.length) return report;

  const admin = createSupabaseAdminClient();
  if (!admin) { report.warnings.push("SUPABASE_NOT_CONFIGURED"); return report; }
  const existing = await loadExisting(admin, options.organizationId);

  if (options.dryRun) {
    for (const stage of manifest.stages) {
      previewStage(stage.seedKey, existing.stages, report.stages);
      for (const program of stage.programs) {
        previewStage(program.key, existing.nodes, report.nodes);
        for (const moduleNode of program.modules) {
          previewStage(moduleNode.key, existing.nodes, report.nodes);
          for (const group of moduleNode.groups) {
            previewStage(group.key, existing.nodes, report.nodes);
            for (const resource of group.resources) {
              previewStage(resource.key, existing.documents, report.documents);
              previewDependent(existing.documents.get(resource.key)?.id, existing.catalogSourceIds, report.catalogItems);
              previewDependent(existing.documents.get(resource.key)?.id, existing.placedResourceIds, report.placements);
            }
          }
        }
      }
      if (stage.assignments.length) {
        previewStage(`${stage.seedKey}-assignments`, existing.nodes, report.nodes);
        for (const assignment of stage.assignments) {
          previewStage(assignment.key, existing.documents, report.documents);
          previewDependent(existing.documents.get(assignment.key)?.id, existing.catalogSourceIds, report.catalogItems);
          previewDependent(existing.documents.get(assignment.key)?.id, existing.placedResourceIds, report.placements);
        }
      }
    }
    return report;
  }

  const org = options.organizationId;
  const actor = options.actorUserId ?? null;

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
  const revive = { career_stages: new Set<string>(), academy_stage_nodes: new Set<string>(), curriculum_documents: new Set<string>(), career_stage_resources: new Set<string>() };

  // Ids are generated here rather than left to the database default, specifically so a child row
  // (a module naming its program, a placement naming its document) can be built in the same pass as
  // its parent without waiting on a round trip to learn the parent's generated id.
  function resolve(store: Map<string, ExistingRow>, key: string, tallyTarget: SeedTally, reviveSet: Set<string>, makeRow: (id: string) => PendingRow, push: (row: PendingRow) => void): string {
    const found = store.get(key);
    if (found) {
      tallyTarget.existing += 1;
      if (found.status === "archived") { tallyTarget.revived += 1; reviveSet.add(found.id); }
      return found.id;
    }
    const id = crypto.randomUUID();
    store.set(key, { id, status: "active" });
    tallyTarget.created += 1;
    push(makeRow(id));
    return id;
  }

  for (const stage of manifest.stages) {
    const stageId = resolve(existing.stages, stage.seedKey, report.stages, revive.career_stages, (id) => ({
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
      const programId = resolve(existing.nodes, program.key, report.nodes, revive.academy_stage_nodes, (id) => ({
        id, organization_id: org, seed_key: program.key,
        stage_id: stageId, parent_id: null, node_type: "program",
        title: program.title, position: programIndex, status: "active", surface: program.surface
      }), (row) => programRows.push(row));

      for (const [moduleIndex, moduleNode] of program.modules.entries()) {
        const moduleId = resolve(existing.nodes, moduleNode.key, report.nodes, revive.academy_stage_nodes, (id) => ({
          id, organization_id: org, seed_key: moduleNode.key,
          stage_id: stageId, parent_id: programId, node_type: "module",
          title: moduleNode.title, position: moduleIndex, status: "active"
        }), (row) => moduleRows.push(row));

        for (const [groupIndex, group] of moduleNode.groups.entries()) {
          const groupId = resolve(existing.nodes, group.key, report.nodes, revive.academy_stage_nodes, (id) => ({
            id, organization_id: org, seed_key: group.key,
            stage_id: stageId, parent_id: moduleId, node_type: "group",
            title: group.title, position: groupIndex, status: "active"
          }), (row) => groupRows.push(row));

          for (const [resourceIndex, resource] of group.resources.entries()) {
            const documentId = resolveDocument(existing, resource, org, actor, report.documents, revive.curriculum_documents, (row) => documentRows.push(row));
            resolveCatalogAndPlacement(existing, documentId, stageId, groupId, resourceIndex, toRequirementType(resource.role),
              { title: resource.title, summary: resource.summary ?? "", tags: resource.tags ?? [] }, org, report, revive.career_stage_resources, catalogRows, placementRows);
          }
        }
      }
    }

    // The manifest gives assignments no home in the program tree and carries only
    // key/title/type/required for each — no brief, no rubric, no pass mark. They are seeded as
    // documents under a per-stage "Bài tập & đánh giá" program with the brief left explicitly
    // unwritten rather than invented.
    if (stage.assignments.length) {
      const assignmentsProgramId = resolve(existing.nodes, `${stage.seedKey}-assignments`, report.nodes, revive.academy_stage_nodes, (id) => ({
        id, organization_id: org, seed_key: `${stage.seedKey}-assignments`,
        stage_id: stageId, parent_id: null, node_type: "program",
        title: "Bài tập & đánh giá", position: stage.programs.length, status: "active", surface: "create"
      }), (row) => programRows.push(row));

      for (const [index, assignment] of stage.assignments.entries()) {
        const documentId = resolve(existing.documents, assignment.key, report.documents, revive.curriculum_documents, (id) => ({
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
          { title: assignment.title, summary: `Bài tập ${assignment.type}`, tags: ["assignment"] }, org, report, revive.career_stage_resources, catalogRows, placementRows);
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

  // Reactivate anything found archived, after the inserts — a table that just received brand new
  // rows in the pass above has nothing to revive yet, so ordering here does not matter, but running
  // it last keeps "create what's missing" and "restore what's archived" as visibly separate steps.
  await Promise.all([
    reviveRows(admin, "career_stages", [...revive.career_stages], report.warnings),
    reviveRows(admin, "academy_stage_nodes", [...revive.academy_stage_nodes], report.warnings),
    reviveRows(admin, "curriculum_documents", [...revive.curriculum_documents], report.warnings),
    reviveRows(admin, "career_stage_resources", [...revive.career_stage_resources], report.warnings)
  ]);

  return report;
}

interface ExistingRow { id: string; status: string }
interface ExistingRows {
  stages: Map<string, ExistingRow>;
  nodes: Map<string, ExistingRow>;
  documents: Map<string, ExistingRow>;
  catalogSourceIds: Map<string, string>; // document id -> content_items status is irrelevant, catalog rows are always active
  placedResourceIds: Map<string, ExistingRow>; // document id -> career_stage_resources row
  maxStagePosition: number;
}

/** Everything the seed needs to know about the organisation's current state, in five queries. */
async function loadExisting(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, organizationId: string): Promise<ExistingRows> {
  const [{ data: stageRows }, { data: nodeRows }, { data: docRows }, { data: catalogRows }, { data: placementRows }] = await Promise.all([
    admin.from("career_stages").select("id,seed_key,position,status").eq("organization_id", organizationId),
    admin.from("academy_stage_nodes").select("id,seed_key,status").eq("organization_id", organizationId).not("seed_key", "is", null),
    admin.from("curriculum_documents").select("id,seed_key,status").eq("organization_id", organizationId).not("seed_key", "is", null),
    admin.from("content_items").select("id,source_id").eq("organization_id", organizationId).eq("source_table", "curriculum_documents"),
    admin.from("career_stage_resources").select("id,resource_id,status").eq("organization_id", organizationId).eq("resource_type", "document")
  ]);

  const seededStages = ((stageRows ?? []) as { id: string; seed_key: string | null; position: number; status: string }[]).filter((row) => row.seed_key);
  const maxPosition = ((stageRows ?? []) as { position: number }[]).reduce((max, row) => Math.max(max, Number(row.position ?? 0)), -1);

  return {
    stages: new Map(seededStages.map((row) => [row.seed_key as string, { id: row.id, status: row.status }])),
    nodes: new Map(((nodeRows ?? []) as { id: string; seed_key: string; status: string }[]).map((row) => [row.seed_key, { id: row.id, status: row.status }])),
    documents: new Map(((docRows ?? []) as { id: string; seed_key: string; status: string }[]).map((row) => [row.seed_key, { id: row.id, status: row.status }])),
    catalogSourceIds: new Map(((catalogRows ?? []) as { id: string; source_id: string }[]).map((row) => [row.source_id, row.id])),
    placedResourceIds: new Map(((placementRows ?? []) as { id: string; resource_id: string; status: string }[]).map((row) => [row.resource_id, { id: row.id, status: row.status }])),
    maxStagePosition: maxPosition
  };
}

function previewStage(key: string, known: Map<string, ExistingRow>, tallyTarget: SeedTally): void {
  const found = known.get(key);
  if (!found) { tallyTarget.created += 1; return; }
  tallyTarget.existing += 1;
  if (found.status === "archived") tallyTarget.revived += 1;
}
function previewDependent(documentId: string | undefined, known: Map<string, unknown> | Map<string, ExistingRow>, tallyTarget: SeedTally): void {
  if (!documentId || !known.has(documentId)) { tallyTarget.created += 1; return; }
  tallyTarget.existing += 1;
  const row = known.get(documentId) as ExistingRow | string;
  if (typeof row === "object" && row.status === "archived") tallyTarget.revived += 1;
}

function resolveDocument(
  existing: ExistingRows, resource: ManifestResource, org: string, actor: string | null,
  tallyTarget: SeedTally, reviveSet: Set<string>, push: (row: Record<string, unknown>) => void
): string {
  const found = existing.documents.get(resource.key);
  if (found) {
    tallyTarget.existing += 1;
    if (found.status === "archived") { tallyTarget.revived += 1; reviveSet.add(found.id); }
    return found.id;
  }
  const id = crypto.randomUUID();
  existing.documents.set(resource.key, { id, status: "active" });
  tallyTarget.created += 1;
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
  item: { title: string; summary: string; tags: string[] }, org: string, report: SeedReport, placementReviveSet: Set<string>,
  catalogRows: Record<string, unknown>[], placementRows: Record<string, unknown>[]
): void {
  if (existing.catalogSourceIds.has(documentId)) {
    report.catalogItems.existing += 1; // content_items has no archived state of its own to revive
  } else {
    existing.catalogSourceIds.set(documentId, "pending");
    report.catalogItems.created += 1;
    catalogRows.push({
      organization_id: org, content_type: "document", source_table: "curriculum_documents", source_id: documentId,
      title: item.title, summary: item.summary, tags: item.tags, status: "active"
    });
  }

  const placed = existing.placedResourceIds.get(documentId);
  if (placed) {
    report.placements.existing += 1;
    if (placed.status === "archived") { report.placements.revived += 1; placementReviveSet.add(placed.id); }
  } else {
    existing.placedResourceIds.set(documentId, { id: "pending", status: "active" });
    report.placements.created += 1;
    placementRows.push({
      organization_id: org, stage_id: stageId, node_id: nodeId,
      resource_type: "document", resource_id: documentId,
      // Without this, the placement has no title of its own and every admin view that lists
      // resources — Content Canvas, stage card counts — has nothing to show but the raw resource_id
      // UUID, since career_stage_resources never joins back to curriculum_documents for display.
      title_override: item.title, summary: item.summary,
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

async function reviveRows(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, table: string, ids: string[], warnings: string[]): Promise<void> {
  for (const batch of chunks(ids, BATCH_SIZE)) {
    const { error } = await admin.from(table).update({ status: "active", updated_at: new Date().toISOString() }).in("id", batch);
    if (error) warnings.push(`${table} revive: ${error.message}`);
  }
}
