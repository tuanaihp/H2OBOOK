export function isAcademicOperationsV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_ACADEMIC_OPERATIONS_V2 === "true";
}

export function isAcademicOperationsPreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ACADEMIC_OPERATIONS_PREVIEW !== "false";
}
