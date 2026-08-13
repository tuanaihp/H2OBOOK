function enabled(value: string | undefined, fallback = true) {
  if (value == null || value === "") return fallback;
  return value !== "false" && value !== "0" && value !== "off";
}

// Mission Workspace V2 (docs/mission-workspace-v2). Unlike lib/stage1-learning-os/feature-flags.ts
// (deliberately Stage-1-only), these apply to every Stage's Mission Workspace — the 4-tab shell,
// completion checklist and adaptive evidence UI are universal, not Stage-1-specific content.
export const missionWorkspaceV2Features = {
  workspaceV2: enabled(process.env.NEXT_PUBLIC_MISSION_WORKSPACE_V2, true),
  readinessCompletionSplit: enabled(process.env.NEXT_PUBLIC_MISSION_READINESS_COMPLETION_SPLIT_V1, true),
  evidenceAdaptiveUi: enabled(process.env.NEXT_PUBLIC_MISSION_EVIDENCE_ADAPTIVE_UI_V1, true)
};
