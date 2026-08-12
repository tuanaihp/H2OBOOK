// Pure comparison at the heart of the Stage Context Validator (fix for P1, docs/academy-data-link-v1/
// 01_PRODUCTION_AUDIT.md) — kept separate from lib/academy-data-link/service.ts's data-fetching so
// the actual "what counts as a mismatch" rule is testable without a database.
//
// Student badge MUST come from: stage_id -> career_stages.id -> career_stages.position/title.
// NEVER from: membership level / journey version number / array index / stage count / hardcode.
export function assertStageContextConsistency(input: { assignedStageId: string; journeyStageId: string | null }): { isConsistent: boolean; issues: string[] } {
  const issues: string[] = [];
  if (input.journeyStageId && input.journeyStageId !== input.assignedStageId) {
    issues.push("Stage học viên được gán khác Stage mà Mission gần nhất đang thuộc về.");
  }
  return { isConsistent: issues.length === 0, issues };
}
