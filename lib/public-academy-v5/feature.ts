export function isPublicAcademyV5Enabled(): boolean {
  return process.env.NEXT_PUBLIC_PUBLIC_ACADEMY_V5 !== "false";
}

export function isPublicMembershipV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_PUBLIC_MEMBERSHIP_V2 !== "false";
}

export function isAuthExperienceV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_EXPERIENCE_V2 !== "false";
}
