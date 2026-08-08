// Shape of the ThuyH2O six-stage manifest (v5/25-H2OBOOK_SIX_STAGE_PRODUCTION_SEED_V1).
// Kept separate from the seeding logic so the validator can reject a malformed manifest before a
// single row is written.

export type ManifestSurface = "learn" | "create" | "business" | "coaching";

export interface ManifestResource {
  key: string;
  title: string;
  resourceType: string;
  summary: string;
  surface: ManifestSurface;
  role: string;
  unlockMode: string;
  tags: string[];
  bodyMarkdown: string;
}

export interface ManifestGroup { key: string; title: string; resources: ManifestResource[] }
export interface ManifestModule { key: string; title: string; groups: ManifestGroup[] }
export interface ManifestProgram { key: string; title: string; surface: ManifestSurface; modules: ManifestModule[] }
export interface ManifestAssignment { key: string; title: string; type: string; required: boolean }

export interface ManifestStage {
  seedKey: string;
  position: number;
  title: string;
  shortTitle?: string;
  duration?: string;
  description?: string;
  outcomes?: string[];
  programs: ManifestProgram[];
  assignments: ManifestAssignment[];
  gate?: { requiredAssignments: string[]; minimumProgress: number };
}

export interface CurriculumManifest {
  schemaVersion: string;
  curriculumKey: string;
  title: string;
  stages: ManifestStage[];
  studentExperience?: Record<string, unknown>;
}

export interface SeedTally {
  created: number;
  existing: number;
  /**
   * Found with our seed_key but status='archived' — from "Lưu trữ giai đoạn" on the stage list, or a
   * per-node archive in the Structure tab, which soft-delete rather than remove the row. Re-running
   * the seed is an explicit "make this curriculum present" request, so an archived match is switched
   * back to active rather than counted as already satisfied and left invisible.
   */
  revived: number;
}

export interface SeedCounts {
  stages: SeedTally;
  nodes: SeedTally;
  documents: SeedTally;
  catalogItems: SeedTally;
  placements: SeedTally;
}

export interface SeedReport extends SeedCounts {
  dryRun: boolean;
  organizationId: string;
  curriculumKey: string;
  warnings: string[];
}

/**
 * Rejects a manifest that would produce a broken curriculum, before anything is written. Seeding
 * half a curriculum and failing in the middle is worse than not starting: the structure is what the
 * admin panel navigates by, and a missing branch is invisible rather than obviously broken.
 */
export function validateManifest(manifest: CurriculumManifest): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  const claim = (key: string, what: string) => {
    if (!key?.trim()) { errors.push(`${what} thiếu key`); return; }
    if (keys.has(key)) errors.push(`Trùng key: ${key}`);
    keys.add(key);
  };

  if (!Array.isArray(manifest.stages) || manifest.stages.length === 0) {
    errors.push("Manifest không có stage nào");
    return errors;
  }

  for (const stage of manifest.stages) {
    claim(stage.seedKey, `Stage "${stage.title}"`);
    if (!Number.isFinite(stage.position)) errors.push(`Stage ${stage.seedKey} thiếu position`);
    for (const program of stage.programs ?? []) {
      claim(program.key, `Program "${program.title}"`);
      for (const moduleNode of program.modules ?? []) {
        claim(moduleNode.key, `Module "${moduleNode.title}"`);
        for (const group of moduleNode.groups ?? []) {
          claim(group.key, `Group "${group.title}"`);
          for (const resource of group.resources ?? []) {
            claim(resource.key, `Resource "${resource.title}"`);
            if (!resource.title?.trim()) errors.push(`Resource ${resource.key} thiếu title`);
          }
        }
      }
    }
    for (const assignment of stage.assignments ?? []) claim(assignment.key, `Assignment "${assignment.title}"`);
  }
  return errors;
}
