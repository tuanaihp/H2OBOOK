// Content Access Engine V1 — vocabulary, adapted from
// v5/18-h2obook-content-access-engine-v1/src/modules/content-access/domain.ts.
//
// The source module carried its own ResourceType list and a ca_resources registry mirroring every
// book and course. Neither is reproduced: resources are addressed the way the rest of this repo
// already addresses them (resource_type + resource_id, matching entitlements and
// career_stage_resources), and the real content stays in its real tables.

export const UNLOCK_MODES = ["immediate", "stage_active", "after_resource", "progress_gte", "date", "manual"] as const;
export type UnlockMode = (typeof UNLOCK_MODES)[number];

export type AccessState = "granted" | "locked" | "denied" | "expired";
export type AccessSource = "purchase" | "admin_grant" | "membership_stage" | "learning_stage" | "free" | "none";

/**
 * One row from entitlements, flattened. `effect` is derived, not stored: an active row is a grant,
 * a revoked one is a deny for that same resource. See the integration report §6 — that is a
 * product decision, deliberately stricter than "revoked simply stops counting", so a membership
 * cannot silently undo an admin's revocation.
 */
export interface AccessGrantFact {
  effect: "grant" | "deny";
  grantKind: "purchase" | "admin" | "legacy" | "revoke";
  reason: string;
  startsAt: string;
  expiresAt: string | null;
}

export interface StageAccessFact {
  stageSlug: string;
  stageName: string;
  stageSequence: number;
  /** True when the stage is reachable at all — membership, grant, or being the free first stage. */
  stageUnlocked: boolean;
  unlockMode: UnlockMode;
  /** Another binding in the same curriculum that must be finished or progressed first. */
  prerequisiteBindingId: string | null;
  requiredProgress: number | null;
  unlockAt: string | null;
  displayLocations: string[];
  viaMembership: boolean;
}

export interface ProgressFact {
  progressPercent: number;
  completedAt: string | null;
}

export interface ResourceAccessFacts {
  /** Only "published" resources are ever openable; anything else is denied before other rules. */
  resourceStatus: "published" | "draft" | "archived";
  /** Marked free_preview in the curriculum map — open to anyone, no account needed. */
  free: boolean;
  grants: AccessGrantFact[];
  stages: StageAccessFact[];
  /** Keyed by binding id, for after_resource and progress_gte. */
  prerequisiteProgress: Record<string, ProgressFact>;
  progress: ProgressFact;
  now: string;
}

export interface ResourceAccessDecision {
  access: AccessState;
  source: AccessSource;
  reason: string;
  expiresAt: string | null;
  stageSlug: string | null;
  stageName: string | null;
  progressPercent: number;
  displayLocations: string[];
}
