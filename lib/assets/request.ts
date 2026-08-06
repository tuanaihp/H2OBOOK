import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { canManageAssetOrganization } from "./organization-rules";

export interface AssetAccess { userId: string; organizationId: string; role: string; canManage: boolean }

/**
 * Shared entry point for /api/assets/* routes. Role and organization are always re-resolved from
 * the session, never taken from the body — and `manage` is checked here rather than relying on the
 * page hiding a button, because a hidden button is not a permission check.
 */
export async function resolveAssetAccess(request: Request, options?: { manage?: boolean }): Promise<{ access: AssetAccess | null; response: NextResponse | null }> {
  const auth = await requireApiUser();
  if (auth.response) return { access: null, response: auth.response };
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const orgAccess = await resolveOrganizationAccess(auth.user!, organizationId);
  if (!orgAccess) return { access: null, response: NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 }) };

  const canManage = canManageAssetOrganization(orgAccess.role);
  if (options?.manage && !canManage) {
    return { access: null, response: NextResponse.json({ error: "ASSET_ORGANIZATION_FORBIDDEN" }, { status: 403 }) };
  }
  return { access: { userId: auth.user!.id, organizationId: orgAccess.organizationId, role: orgAccess.role, canManage }, response: null };
}
