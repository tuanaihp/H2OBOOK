import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import contentManifestJson from "./content-v2-manifest.json";
import type { ContentUpgradeReport, ContentUpgradeTally, ContentV2Manifest, ContentV2Resource } from "./content-v2-types";

// Upgrades the 80 documents lib/curriculum/seed.ts already created from a shared template into real
// per-resource teaching content (v5/26-H2OBOOK_CURRICULUM_CONTENT_V2_PRODUCTION), keyed by the same
// seed_key the V1 seed used. Nothing here creates a stage, node, document or placement — every key
// this manifest names is expected to already exist; a key it can't find is reported as `missing`,
// never invented.
//
// Idempotent by content_version rather than by row existence: a document upgraded once is at
// content_version 2 and is left alone on every later run (so an admin's hand-edit after the upgrade
// is never clobbered by re-running it), while a document still at 1 is upgraded. Stage playbooks use
// the same idea without a counter — an empty `{}` means "never set", so it's applied once and then
// left alone.
//
// Explicitly not attempted: the source package's five-legacy-stage reconciliation. Checked directly
// against production before writing this — the five legacy stages (plus two stray hand-created ones)
// are already status='archived', and the six stages this content targets were seeded as new rows by
// module 25, not by renaming the legacy five. There is no live 5-stage state left to reconcile.

const manifest = contentManifestJson as unknown as ContentV2Manifest;

const emptyTally = (): ContentUpgradeTally => ({ updated: 0, alreadyCurrent: 0, missing: [] });

const BATCH_SIZE = 50;
function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface ContentUpgradeOptions {
  organizationId: string;
  actorUserId?: string | null;
  dryRun?: boolean;
}

export async function upgradeCurriculumContentV2(options: ContentUpgradeOptions): Promise<ContentUpgradeReport> {
  const report: ContentUpgradeReport = {
    dryRun: Boolean(options.dryRun),
    organizationId: options.organizationId,
    curriculumKey: manifest.curriculumKey,
    documents: emptyTally(),
    stages: emptyTally(),
    placementTitles: { backfilled: 0, alreadyPresent: 0 },
    experienceDrafts: { written: 0, alreadyPresent: 0 },
    warnings: []
  };

  const admin = createSupabaseAdminClient();
  if (!admin) { report.warnings.push("SUPABASE_NOT_CONFIGURED"); return report; }
  const org = options.organizationId;

  const [{ data: docRows }, { data: stageRows }, { data: placementRows }, { data: uiConfigRows }] = await Promise.all([
    admin.from("curriculum_documents").select("id,seed_key,content_version,title,summary").eq("organization_id", org).not("seed_key", "is", null),
    admin.from("career_stages").select("id,seed_key,playbook").eq("organization_id", org).not("seed_key", "is", null),
    admin.from("career_stage_resources").select("id,resource_id,title_override").eq("organization_id", org).eq("resource_type", "document"),
    admin.from("academy_stage_ui_config").select("stage_id,version,config").eq("organization_id", org)
  ]);

  type DocRow = { id: string; seed_key: string; content_version: number; title: string; summary: string };
  const docsBySeedKey = new Map(((docRows ?? []) as DocRow[]).map((r) => [r.seed_key, r]));
  const docsById = new Map(((docRows ?? []) as DocRow[]).map((r) => [r.id, r]));
  const stagesBySeedKey = new Map(((stageRows ?? []) as { id: string; seed_key: string; playbook: Record<string, unknown> | null }[]).map((r) => [r.seed_key, r]));
  const placementsByDocId = new Map<string, { id: string; title_override: string | null }[]>();
  for (const row of (placementRows ?? []) as { id: string; resource_id: string; title_override: string | null }[]) {
    const list = placementsByDocId.get(row.resource_id) ?? [];
    list.push(row);
    placementsByDocId.set(row.resource_id, list);
  }
  const v2DraftExistsByStage = new Set(
    ((uiConfigRows ?? []) as { stage_id: string; version: number; config: Record<string, unknown> | null }[])
      .filter((r) => r.config && (r.config as Record<string, unknown>).schemaVersion === "curriculum-content-v2")
      .map((r) => r.stage_id)
  );
  const maxVersionByStage = new Map<string, number>();
  for (const row of (uiConfigRows ?? []) as { stage_id: string; version: number }[]) {
    maxVersionByStage.set(row.stage_id, Math.max(maxVersionByStage.get(row.stage_id) ?? 0, row.version));
  }

  const documentUpdates: { id: string; row: Record<string, unknown> }[] = [];
  const stageUpdates: { id: string; row: Record<string, unknown> }[] = [];
  const placementTitleUpdates: { id: string; row: Record<string, unknown> }[] = [];
  const uiConfigInserts: Record<string, unknown>[] = [];

  function upgradeResource(resource: ContentV2Resource): void {
    const doc = docsBySeedKey.get(resource.key);
    if (!doc) { report.documents.missing.push(resource.key); return; }

    if (doc.content_version >= 2) {
      report.documents.alreadyCurrent += 1;
    } else {
      report.documents.updated += 1;
      documentUpdates.push({
        id: doc.id,
        row: {
          summary: resource.summary,
          body_markdown: resource.contentMarkdown,
          tags: resource.tags,
          content_version: 2,
          structured_content: {
            objectives: resource.objectives,
            principles: resource.principles,
            workflow: resource.workflow,
            case: resource.case,
            studentAction: resource.studentAction,
            evidence: resource.evidence,
            kpis: resource.kpis,
            mistakes: resource.mistakes,
            coach: resource.coach,
            teacherNote: resource.teacherNote,
            completionPolicy: resource.completionPolicy,
            h2oBrainHints: resource.h2oBrainHints,
            estimatedMinutes: resource.estimatedMinutes
          }
        }
      });
    }

  }

  // Titles for every document placement, not only the 80 this manifest carries content for. The
  // assignment documents the V1 seed created are not in the V2 manifest at all, so keying the
  // backfill off the manifest would leave those cards showing a raw UUID forever; the document's own
  // title is the right source for all of them either way.
  for (const [documentId, placements] of placementsByDocId) {
    const doc = docsById.get(documentId);
    if (!doc) continue;
    for (const placement of placements) {
      if (placement.title_override && placement.title_override.trim()) {
        report.placementTitles.alreadyPresent += 1;
      } else {
        report.placementTitles.backfilled += 1;
        placementTitleUpdates.push({ id: placement.id, row: { title_override: doc.title, summary: doc.summary } });
      }
    }
  }

  for (const stage of manifest.stages) {
    const stageRow = stagesBySeedKey.get(stage.stableStageSeedKey);
    if (!stageRow) {
      report.stages.missing.push(stage.stableStageSeedKey);
    } else if (stageRow.playbook && Object.keys(stageRow.playbook).length > 0) {
      report.stages.alreadyCurrent += 1;
    } else {
      report.stages.updated += 1;
      stageUpdates.push({ id: stageRow.id, row: { playbook: stage.playbook } });
    }

    for (const resource of stage.resources) upgradeResource(resource);

    if (stageRow) {
      if (v2DraftExistsByStage.has(stageRow.id)) {
        report.experienceDrafts.alreadyPresent += 1;
      } else {
        report.experienceDrafts.written += 1;
        uiConfigInserts.push({
          organization_id: org, stage_id: stageRow.id,
          version: (maxVersionByStage.get(stageRow.id) ?? 0) + 1,
          status: "draft",
          config: { ...manifest.studentExperienceV2, schemaVersion: "curriculum-content-v2", stagePosition: stage.stagePosition },
          created_by: options.actorUserId ?? null
        });
        maxVersionByStage.set(stageRow.id, (maxVersionByStage.get(stageRow.id) ?? 0) + 1);
      }
    }
  }

  if (report.dryRun) return report;

  for (const { id, row } of documentUpdates) {
    const { error } = await admin.from("curriculum_documents").update(row).eq("id", id);
    if (error) report.warnings.push(`curriculum_documents[${id}]: ${error.message}`);
  }
  for (const { id, row } of stageUpdates) {
    const { error } = await admin.from("career_stages").update(row).eq("id", id);
    if (error) report.warnings.push(`career_stages[${id}]: ${error.message}`);
  }
  for (const batch of chunks(placementTitleUpdates, BATCH_SIZE)) {
    // Titles differ per row, so this is one request per placement rather than a single batched
    // `.in()` update — there are at most 80, well inside the route's execution budget.
    for (const { id, row } of batch) {
      const { error } = await admin.from("career_stage_resources").update(row).eq("id", id);
      if (error) report.warnings.push(`career_stage_resources[${id}]: ${error.message}`);
    }
  }
  if (uiConfigInserts.length) {
    const { error } = await admin.from("academy_stage_ui_config").insert(uiConfigInserts);
    if (error) report.warnings.push(`academy_stage_ui_config: ${error.message}`);
  }

  return report;
}
