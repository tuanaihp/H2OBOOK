// Same per-file enabled() helper every prior module this session uses (lib/stage1-learning-os/
// feature-flags.ts, lib/mission-workspace/feature-flags.ts) — a DB-backed flags table was considered
// (source spec proposes one) and rejected in docs/H2O_LEARNING_JOURNEY_AUDIT.md §2 to avoid a second,
// inconsistent flag mechanism.
function enabled(value: string | undefined, fallback = true) {
  if (value == null || value === "") return fallback;
  return value !== "false" && value !== "0" && value !== "off";
}

export const learningJourneyFeatures = {
  dailyLogV1: enabled(process.env.NEXT_PUBLIC_LEARNING_JOURNEY_LOG_V1),
  capabilitySnapshotsV1: enabled(process.env.NEXT_PUBLIC_LEARNING_CAPABILITY_SNAPSHOTS_V1),
  // Off by default in V1 per the source spec — a Mission cannot yet require a Daily Log entry before
  // it can be completed. Flipping this on is a product decision, not an implementation detail.
  evidenceCompletionGate: enabled(process.env.NEXT_PUBLIC_LEARNING_EVIDENCE_COMPLETION_GATE, false)
};
