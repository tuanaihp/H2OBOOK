function enabled(value: string | undefined, fallback = true) {
  if (value == null || value === "") return fallback;
  return value !== "false" && value !== "0" && value !== "off";
}

export const stage1LearningOsFeatures = {
  stage1FlowV1: enabled(process.env.NEXT_PUBLIC_STAGE1_LEARNING_OS_V1),
  knownContext: enabled(process.env.NEXT_PUBLIC_MISSION_KNOWN_CONTEXT_V1),
  outputReuse: enabled(process.env.NEXT_PUBLIC_MISSION_OUTPUT_REUSE_V1),
  dailyPractice: enabled(process.env.NEXT_PUBLIC_DAILY_PRACTICE_V1),
  skillPassport: enabled(process.env.NEXT_PUBLIC_SKILL_PASSPORT_V1),
  credentialWallet: enabled(process.env.NEXT_PUBLIC_CREDENTIAL_WALLET_V1)
};
