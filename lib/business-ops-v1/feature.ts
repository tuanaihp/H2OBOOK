export function isBusinessOpsV1Enabled() {
  return process.env.NEXT_PUBLIC_BUSINESS_COMMERCE_GROWTH_OPS_V1 === "true";
}

export function isBusinessOpsV1PreviewEnabled() {
  return process.env.NEXT_PUBLIC_BUSINESS_COMMERCE_GROWTH_OPS_PREVIEW !== "false";
}
