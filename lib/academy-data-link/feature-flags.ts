function enabled(value: string | undefined, fallback = true) {
  if (value == null || value === "") return fallback;
  return value !== "false" && value !== "0" && value !== "off";
}

export const academyDataLinkFeatures = {
  dataLinkOverview: enabled(process.env.NEXT_PUBLIC_ACADEMY_DATA_LINK_V1),
  setupGuide: enabled(process.env.NEXT_PUBLIC_ACADEMY_SETUP_GUIDE_V1),
  resourceUsageInspector: enabled(process.env.NEXT_PUBLIC_ACADEMY_RESOURCE_USAGE_V1),
  stageContextValidator: enabled(process.env.NEXT_PUBLIC_STUDENT_STAGE_CONTEXT_VALIDATOR_V1)
};
