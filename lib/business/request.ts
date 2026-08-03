import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { getBusinessAccessSnapshot } from "./snapshot";
import type { BusinessAccessSnapshot } from "./types";

const BUSINESS_ROLES = ["student", "admin", "owner"] as const;

// Shared entry point for every /api/business/* route — mirrors lib/teaching/request.ts. Role and
// organization membership are always re-resolved from the session server-side, never trusted
// from the client (CLAUDE_INTEGRATION_PROMPT.md §5: "Không tin role, plan, feature hoặc stage từ
// localStorage, query string hay client state").
export async function resolveBusinessAccess(request: Request): Promise<{ access: BusinessAccessSnapshot | null; response: NextResponse | null }> {
  const auth = await requireApiUser();
  if (auth.response) return { access: null, response: auth.response };
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const orgAccess = await resolveOrganizationAccess(auth.user!, organizationId, [...BUSINESS_ROLES]);
  if (!orgAccess) return { access: null, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  const access = await getBusinessAccessSnapshot(auth.user!.id, orgAccess.organizationId, orgAccess.role);
  if (!access) return { access: null, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { access, response: null };
}
