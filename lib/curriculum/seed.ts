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
// admin, and the student side follows. That is the whole point of routing the seed through these
// tables rather than pushing rows at the student experience directly.
//
// Every step is keyed by the manifest's stable seed keys and is insert-if-missing: re-running finds
// what it made last time and leaves it alone, so an admin who renamed a program or moved a resource
// does not lose that work on the next run.

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
    for (const stage of manifest.stages) {
      report.stages.created += 1;
      for (const program of stage.programs) {
        report.nodes.created += 1;
        for (const moduleNode of program.modules) {
          report.nodes.created += 1;
          for (const group of moduleNode.groups) {
            report.nodes.created += 1;
            report.documents.created += group.resources.length;
            report.catalogItems.created += group.resources.length;
            report.placements.created += group.resources.length;
          }
        }
      }
      // The assignments program below is created per stage, plus one document each.
      report.nodes.created += 1;
      report.documents.created += stage.assignments.length;
      report.catalogItems.created += stage.assignments.length;
      report.placements.created += stage.assignments.length;
    }
    return report;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) { report.warnings.push("SUPABASE_NOT_CONFIGURED"); return report; }
  const org = options.organizationId;
  const actor = options.actorUserId ?? null;

  /** Finds a row by seed key or creates it. Never updates: an existing row may carry admin edits. */
  async function upsertBySeedKey<T extends Record<string, unknown>>(table: string, seedKey: string, insert: T, tally: Counter): Promise<string | null> {
    const { data: existing } = await admin!.from(table).select("id").eq("organization_id", org).eq("seed_key", seedKey).maybeSingle();
    if (existing?.id) { tally.existing += 1; return String(existing.id); }
    const { data, error } = await admin!.from(table).insert({ ...insert, organization_id: org, seed_key: seedKey }).select("id").single();
    if (error || !data) { report.warnings.push(`${table}[${seedKey}]: ${error?.message ?? "insert failed"}`); return null; }
    tally.created += 1;
    return String(data.id);
  }

  async function upsertCatalogItem(documentId: string, resource: { title: string; summary: string; tags: string[] }): Promise<void> {
    const { data: existing } = await admin!.from("content_items").select("id")
      .eq("organization_id", org).eq("source_table", "curriculum_documents").eq("source_id", documentId).maybeSingle();
    if (existing?.id) { report.catalogItems.existing += 1; return; }
    const { error } = await admin!.from("content_items").insert({
      organization_id: org, content_type: "document", source_table: "curriculum_documents", source_id: documentId,
      title: resource.title, summary: resource.summary, tags: resource.tags, status: "active"
    });
    if (error) { report.warnings.push(`content_items[${documentId}]: ${error.message}`); return; }
    report.catalogItems.created += 1;
  }

  async function upsertPlacement(stageId: string, nodeId: string | null, documentId: string, position: number, requirementType: string): Promise<void> {
    const { data: existing } = await admin!.from("career_stage_resources").select("id")
      .eq("organization_id", org).eq("stage_id", stageId).eq("resource_type", "document").eq("resource_id", documentId).maybeSingle();
    if (existing?.id) { report.placements.existing += 1; return; }
    const { error } = await admin!.from("career_stage_resources").insert({
      organization_id: org, stage_id: stageId, node_id: nodeId,
      resource_type: "document", resource_id: documentId,
      position, requirement_type: requirementType,
      // Visible and open, as requested for review. Tightening later is a change of `access` on these
      // rows — see docs/module-25-six-stage-seed-audit.md for the exact statement.
      access: "free_preview", unlock_mode: "immediate", status: "active",
      display_locations: ["library", "journey"]
      // surface is deliberately left null so each resource inherits it from its program node
      // (migration 0043), which is what makes one program-level choice cover everything beneath it.
    });
    if (error) { report.warnings.push(`placement[${documentId}]: ${error.message}`); return; }
    report.placements.created += 1;
  }

  async function upsertDocument(resource: ManifestResource): Promise<string | null> {
    return upsertBySeedKey("curriculum_documents", resource.key, {
      doc_type: toDocType(resource.resourceType),
      title: resource.title,
      summary: resource.summary ?? "",
      body_markdown: resource.bodyMarkdown ?? "",
      tags: resource.tags ?? [],
      status: "active",
      created_by: actor
    }, report.documents);
  }

  // Seeded stages are appended after whatever the organisation already has rather than starting at
  // zero. Two stages sitting at the same position is not a constraint violation, it just makes the
  // list order arbitrary — and silently reordering or removing stages an admin created would be a
  // far worse way to make room. index_label still shows 01–06, so the numbering the manifest
  // intends is what gets displayed regardless of where they sort.
  const { data: positionRows } = await admin.from("career_stages").select("position").eq("organization_id", org).order("position", { ascending: false }).limit(1);
  const basePosition = Number((positionRows ?? [])[0]?.position ?? -1) + 1;

  for (const stage of manifest.stages) {
    const stageId = await upsertBySeedKey("career_stages", stage.seedKey, {
      // The manifest counts stages from 1; career_stages.position is 0-based everywhere else in
      // this codebase (defaultStageSeed, nextStagePosition, the "Giai đoạn {position + 1}" labels).
      slug: stage.seedKey,
      position: basePosition + Math.max(stage.position - 1, 0),
      index_label: String(stage.position).padStart(2, "0"),
      title: stage.title,
      subtitle: stage.shortTitle ?? null,
      description: stage.description ?? null,
      duration_label: stage.duration ?? null,
      skills: stage.outcomes ?? [],
      status: "active"
    }, report.stages);
    if (!stageId) continue;

    for (const [programIndex, program] of stage.programs.entries()) {
      const programId = await upsertBySeedKey("academy_stage_nodes", program.key, {
        stage_id: stageId, parent_id: null, node_type: "program",
        title: program.title, position: programIndex, status: "active",
        // Only the program declares a surface; modules, groups and resources inherit it.
        surface: program.surface
      }, report.nodes);
      if (!programId) continue;

      for (const [moduleIndex, moduleNode] of program.modules.entries()) {
        const moduleId = await upsertBySeedKey("academy_stage_nodes", moduleNode.key, {
          stage_id: stageId, parent_id: programId, node_type: "module",
          title: moduleNode.title, position: moduleIndex, status: "active"
        }, report.nodes);
        if (!moduleId) continue;

        for (const [groupIndex, group] of moduleNode.groups.entries()) {
          const groupId = await upsertBySeedKey("academy_stage_nodes", group.key, {
            stage_id: stageId, parent_id: moduleId, node_type: "group",
            title: group.title, position: groupIndex, status: "active"
          }, report.nodes);
          if (!groupId) continue;

          for (const [resourceIndex, resource] of group.resources.entries()) {
            const documentId = await upsertDocument(resource);
            if (!documentId) continue;
            await upsertCatalogItem(documentId, { title: resource.title, summary: resource.summary ?? "", tags: resource.tags ?? [] });
            await upsertPlacement(stageId, groupId, documentId, resourceIndex, toRequirementType(resource.role));
          }
        }
      }
    }

    // The manifest lists assignments per stage but gives them no home in the program tree, and it
    // carries only key/title/type/required for each — no brief, no rubric, no pass mark. They are
    // seeded as documents under a per-stage "Bài tập & đánh giá" program so an admin can see and
    // fill them in; wiring them to assignment_definitions would mean inventing the instructions and
    // grading criteria the manifest does not contain.
    if (stage.assignments.length) {
      const assignmentsProgramId = await upsertBySeedKey("academy_stage_nodes", `${stage.seedKey}-assignments`, {
        stage_id: stageId, parent_id: null, node_type: "program",
        title: "Bài tập & đánh giá", position: stage.programs.length, status: "active", surface: "create"
      }, report.nodes);

      if (assignmentsProgramId) {
        for (const [index, assignment] of stage.assignments.entries()) {
          const documentId = await upsertBySeedKey("curriculum_documents", assignment.key, {
            doc_type: "assignment",
            title: assignment.title,
            summary: `Bài tập dạng ${assignment.type}${assignment.required ? " — bắt buộc" : " — tùy chọn"}`,
            body_markdown: [
              `# ${assignment.title}`,
              "",
              `- Dạng bài: ${assignment.type}`,
              `- Mức độ: ${assignment.required ? "Bắt buộc" : "Tùy chọn"}`,
              "",
              "## Đề bài",
              "_Chưa có nội dung — cần biên soạn._",
              "",
              "## Tiêu chí đạt",
              "_Chưa có tiêu chí chấm — cần biên soạn._"
            ].join("\n"),
            tags: ["assignment", assignment.type],
            status: "active",
            created_by: actor
          }, report.documents);
          if (!documentId) continue;
          await upsertCatalogItem(documentId, { title: assignment.title, summary: `Bài tập ${assignment.type}`, tags: ["assignment"] });
          await upsertPlacement(stageId, assignmentsProgramId, documentId, index, assignment.required ? "required" : "optional");
        }
      }
    }
  }

  return report;
}
