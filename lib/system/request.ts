import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { hasCapability } from "./permissions";
import type { SystemAccessSnapshot, WorkspaceRole } from "./types";

const SYSTEM_ROLES = ["admin", "owner"] as const;

// Shared entry point for /api/system/* routes and the /system page — mirrors lib/teaching/
// request.ts and lib/business/request.ts. Role is always re-resolved from the session
// server-side (resolveOrganizationAccess), never trusted from the client
// (CLAUDE_INTEGRATION_PROMPT.md §"Do not trust role, plan, feature flags or workspace ID from
// localStorage or client props").
export async function resolveSystemAccess(request: Request): Promise<{ access: SystemAccessSnapshot | null; response: NextResponse | null }> {
  const auth = await requireApiUser();
  if (auth.response) return { access: null, response: auth.response };
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const orgAccess = await resolveOrganizationAccess(auth.user!, organizationId, [...SYSTEM_ROLES]);
  if (!orgAccess) return { access: null, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  const role = orgAccess.role as WorkspaceRole;
  if (!hasCapability({ role, userId: auth.user!.id, workspaceId: orgAccess.organizationId }, "system.view")) {
    return { access: null, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }
  return { access: { userId: auth.user!.id, organizationId: orgAccess.organizationId, role, capabilities: ["system.view", "system.manage", "security.view", "integrations.view", "audit.view"] }, response: null };
}

export async function resolveSystemAccessForPage(userId: string, organizationId: string, role: string): Promise<SystemAccessSnapshot | null> {
  if (role !== "admin" && role !== "owner") return null;
  return { userId, organizationId, role: role as WorkspaceRole, capabilities: ["system.view", "system.manage", "security.view", "integrations.view", "audit.view"] };
}
