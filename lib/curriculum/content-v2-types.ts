// Shape of the Curriculum Content V2 manifest (v5/26-H2OBOOK_CURRICULUM_CONTENT_V2_PRODUCTION).
//
// This is an *enrichment* manifest, not a structural one: every resource and stage key here is
// expected to already exist (created by lib/curriculum/seed.ts from the V1 manifest). There is no
// position/parent/tree shape to validate — just real teaching content keyed by the same stable keys.

export interface ContentV2CompletionPolicy {
  requiresEvidence: boolean;
  requiresReflection: boolean;
  minimumEvidenceCount: number;
}

export interface ContentV2Resource {
  key: string;
  stagePosition: number;
  programKey: string;
  moduleKey: string;
  groupKey: string;
  title: string;
  resourceType: string;
  summary: string;
  role: string;
  surface: string;
  tags: string[];
  estimatedMinutes: number;
  objectives: string[];
  principles: string[];
  workflow: string[];
  case: string;
  studentAction: string;
  evidence: string[];
  kpis: string[];
  mistakes: string[];
  coach: string[];
  teacherNote: string;
  completionPolicy: ContentV2CompletionPolicy;
  h2oBrainHints: Record<string, unknown>;
  contentMarkdown: string;
}

export interface ContentV2Playbook {
  promise: string;
  weeklyRhythm: string[];
  businessFocus: string[];
  coachFocus: string[];
  stageKpis: string[];
}

export interface ContentV2Stage {
  stagePosition: number;
  stableStageSeedKey: string;
  displayTitle: string;
  subtitle: string;
  playbook: ContentV2Playbook;
  resources: ContentV2Resource[];
}

export interface ContentV2Manifest {
  schemaVersion: string;
  curriculumKey: string;
  contentVersion: number;
  studentExperienceV2: Record<string, unknown>;
  stages: ContentV2Stage[];
}

export interface ContentUpgradeTally {
  updated: number;
  alreadyCurrent: number;
  missing: string[];
}

export interface ContentUpgradeReport {
  dryRun: boolean;
  organizationId: string;
  curriculumKey: string;
  documents: ContentUpgradeTally;
  stages: ContentUpgradeTally;
  /**
   * career_stage_resources rows for a document whose title_override was still null — from before
   * this fix, every document placement showed its raw UUID in the admin Content Canvas instead of a
   * title, because the seed never copied a title onto the placement row itself. Backfilled here since
   * it is the same "find real content by seed_key and apply it" operation as everything else in this
   * upgrade, and V2 content is not visible to admins at all until this is fixed.
   */
  placementTitles: { backfilled: number; alreadyPresent: number };
  experienceDrafts: { written: number; alreadyPresent: number };
  warnings: string[];
}
