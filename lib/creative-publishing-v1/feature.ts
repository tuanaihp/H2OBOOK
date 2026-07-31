export function isCreativePublishingOpsV1Enabled(): boolean {
  return process.env.NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_V1 === "true";
}

export function isCreativePublishingOpsPreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_PREVIEW !== "false";
}
