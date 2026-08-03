// Pure capability resolution — adapted from
// v5/14-h2obook-system-control-plane-operations-intelligence-v2/src/core/permissions.ts, trimmed
// to the two real privileged roles (see types.ts). Reviewer/Admissions/Support Agent/Operations
// Manager/System Admin capability sets from the source module are not implemented here — there
// is no database-backed role to attach them to yet (see the integration report).
import type { PermissionContext, SystemCapability, WorkspaceRole } from "./types";

const ROLE_CAPABILITIES: Record<WorkspaceRole, ReadonlySet<SystemCapability>> = {
  student: new Set(),
  teacher: new Set(),
  designer: new Set(),
  partner: new Set(),
  admin: new Set(["system.view", "system.manage", "security.view", "integrations.view", "audit.view"]),
  owner: new Set(["system.view", "system.manage", "security.view", "integrations.view", "audit.view"])
};

export function hasCapability(context: PermissionContext, capability: SystemCapability): boolean {
  return ROLE_CAPABILITIES[context.role].has(capability);
}

export function canAccessSystem(context: PermissionContext): boolean {
  return hasCapability(context, "system.view");
}
