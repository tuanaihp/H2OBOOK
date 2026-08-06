import { NextResponse } from "next/server";
import { resolveAssetAccess } from "@/lib/assets/request";
import { moveAssetsToFolder } from "@/lib/assets/organization";

/**
 * Bulk move. Touches only the ids sent, and the update is scoped by organization as well, so an id
 * copied from another workspace matches no row rather than moving someone else's asset. The count
 * returned is what the database actually changed, not what was asked for — if they differ, the
 * caller learns that some ids were rejected instead of being told everything worked.
 */
export async function POST(request: Request) {
  const { access, response } = await resolveAssetAccess(request, { manage: true });
  if (response) return response;
  const body = await request.json().catch(() => null) as { action?: string; assetIds?: string[]; folderId?: string | null } | null;
  if (body?.action !== "move") return NextResponse.json({ error: "UNSUPPORTED_ACTION" }, { status: 400 });
  if (!Array.isArray(body.assetIds) || body.assetIds.length === 0) return NextResponse.json({ error: "NO_ASSETS_SELECTED" }, { status: 400 });

  const result = await moveAssetsToFolder(access!.organizationId, body.assetIds.map(String), body.folderId ?? null);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ...result.data, requested: body.assetIds.length });
}
