import type { AcademyCapability, AcademyRole } from "./types";

const ALL_CAPABILITIES: AcademyCapability[] = ["academy.dashboard.read", "academy.course.read", "academy.course.write", "academy.entitlement.read", "academy.entitlement.grant"];

// Owner/Admin get every Academy capability this pass implements. Every other real role
// (teacher/designer/partner/student) gets none — Instructor/Content Manager scoped delegation
// from the source module's Phase 3 is deferred (see the integration report): this repo's
// 'teacher' DB role is broader than the source module's narrow "assigned classes/lessons only"
// Instructor concept, and granting it full course-authoring here would be a real privilege
// escalation beyond what module 12 (Teaching Intelligence Center) established for teachers.
export function capabilitiesForRole(role: AcademyRole): AcademyCapability[] {
  if (role === "admin" || role === "owner") return ALL_CAPABILITIES;
  return [];
}

export function hasAcademyCapability(role: AcademyRole, capability: AcademyCapability): boolean {
  return capabilitiesForRole(role).includes(capability);
}
