import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { capabilitiesForRole } from "./access";
import type { AcademyAdminAccess, AcademyRole } from "./types";

const ACADEMY_ADMIN_ROLES = ["admin", "owner"] as const;

// Shared entry point for /api/academy-admin/* routes — mirrors lib/teaching/request.ts,
// lib/business/request.ts and lib/system/request.ts. Role/organization membership is always
// re-resolved server-side from the session, never trusted from the client.
export async function resolveAcademyAdminAccess(request: Request): Promise<{ access: AcademyAdminAccess | null; response: NextResponse | null }> {
  const auth = await requireApiUser();
  if (auth.response) return { access: null, response: auth.response };
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const orgAccess = await resolveOrganizationAccess(auth.user!, organizationId, [...ACADEMY_ADMIN_ROLES]);
  if (!orgAccess) return { access: null, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  const role = orgAccess.role as AcademyRole;
  return { access: { userId: auth.user!.id, organizationId: orgAccess.organizationId, role, capabilities: capabilitiesForRole(role) }, response: null };
}
