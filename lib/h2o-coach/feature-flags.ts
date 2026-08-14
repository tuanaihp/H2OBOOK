// Same per-file enabled() helper every prior module this session uses. coachWorkspaceV1 defaults to
// OFF (unlike most flags this session, which default on) — the source prompt's own rollout plan is
// explicit: "Phase 1: owner/admin only Builder, rollout 100% Stage 1 sau QA", i.e. this is meant to
// launch as an opt-in pilot the admin turns on after configuring and reviewing a real Stage's Coach
// profile, not something that silently replaces the 4-tab Mission Workspace for every student the
// moment this ships. Coach Builder access itself is never flag-gated — it is owner/admin role-gated
// (RLS + resolveAcademyAdminAccess), which is a stronger and simpler guarantee than an env var.
function enabled(value: string | undefined, fallback = true) {
  if (value == null || value === "") return fallback;
  return value !== "false" && value !== "0" && value !== "off";
}

export const h2oCoachFeatures = {
  coachWorkspaceV1: enabled(process.env.NEXT_PUBLIC_H2O_COACH_WORKSPACE_V1, false)
};
