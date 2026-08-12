// Pure list logic behind the Journey Tree Editor's reorder and safe-delete checks
// (v5/35-H2OBOOK_JOURNEY_TREE_EDITOR_V1) — kept out of lib/learn-outcome/admin.ts so the actual
// decision rules are testable without a database, the same split folder 34 used for
// stageDisplayRank/assertStageContextConsistency.

export interface PositionedNode { id: string; position: number }

/**
 * Same-parent ↑↓ swap (§10): who a node should trade `position` with to move one slot in the given
 * direction, given its full sibling list (any order). Returns null at either end — "cannot move
 * further" — never wraps around.
 */
export function computeSiblingSwap<T extends PositionedNode>(siblings: T[], nodeId: string, direction: -1 | 1): { current: T; swapWith: T } | null {
  const ordered = [...siblings].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((s) => s.id === nodeId);
  if (index === -1) return null;
  const swapWith = ordered[index + direction];
  if (!swapWith) return null;
  return { current: ordered[index], swapWith };
}

/**
 * §8 safe-delete: which rows in `candidates` (Missions whose prerequisite_mission_id lands inside
 * the subtree being deleted) reference the subtree from OUTSIDE it. A reference from inside the same
 * subtree is fine — that Mission is being deleted too, together with whatever it depended on.
 */
export function findOutsidePrerequisiteReferences<T extends { id: string }>(candidates: T[], subtreeMissionIds: string[]): T[] {
  const subtreeSet = new Set(subtreeMissionIds);
  return candidates.filter((row) => !subtreeSet.has(row.id));
}
