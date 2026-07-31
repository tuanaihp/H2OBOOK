export function isSystemGovernanceOpsV2Enabled() {
  return process.env.NEXT_PUBLIC_SYSTEM_GOVERNANCE_OPERATIONS_V2 === "true";
}

export function isSystemGovernanceOpsV2PreviewEnabled() {
  return process.env.NEXT_PUBLIC_SYSTEM_GOVERNANCE_OPERATIONS_V2_PREVIEW !== "false";
}
