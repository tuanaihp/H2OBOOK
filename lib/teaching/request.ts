import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { getTeachingAccessSnapshot } from "./access";
import type { TeachingAccessSnapshot } from "./types";

const TEACHING_ROLES = ["owner", "admin", "teacher"] as const;

// Shared entry point for every /api/teaching/* route: verifies the session, resolves real
// organization membership + role (never trusted from the client), then builds the scoped
// TeachingAccessSnapshot. Any route that skips this and reads request body/query for role or
// scope instead would violate CLAUDE_INTEGRATION_PROMPT.md §A.
export async function resolveTeachingAccess(request: Request): Promise<{ access: TeachingAccessSnapshot | null; response: NextResponse | null }> {
  const auth = await requireApiUser();
  if (auth.response) return { access: null, response: auth.response };
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const orgAccess = await resolveOrganizationAccess(auth.user!, organizationId, [...TEACHING_ROLES]);
  if (!orgAccess) return { access: null, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  const access = await getTeachingAccessSnapshot(auth.user!, orgAccess.organizationId, orgAccess.role);
  if (!access) return { access: null, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { access, response: null };
}
