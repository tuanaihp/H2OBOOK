import { NextResponse } from "next/server";
import { resolveAssetAccess } from "@/lib/assets/request";
import { archiveFolder, folderAssetCounts, listFolders, restoreFolder, updateFolder } from "@/lib/assets/organization";
import { collectSubtreeIds } from "@/lib/assets/organization-rules";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAssetAccess(request, { manage: true });
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { name?: string; parentId?: string | null; position?: number; archived?: boolean } | null;
  if (!body) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });

  if (body.archived === false) {
    const restored = await restoreFolder(access!.organizationId, id);
    if (!restored.ok) return NextResponse.json({ error: restored.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const result = await updateFolder(access!.organizationId, id, {
    name: typeof body.name === "string" ? body.name : undefined,
    parentId: body.parentId === undefined ? undefined : body.parentId,
    position: typeof body.position === "number" ? body.position : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/**
 * Archive, not delete. A folder still holding assets is refused outright: removing it would either
 * orphan those assets or cascade into losing them, and neither is what tidying a folder list means.
 * The check counts the whole subtree, because archiving a parent takes its children with it.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAssetAccess(request, { manage: true });
  if (response) return response;
  const { id } = await params;

  const [folders, counts] = await Promise.all([
    listFolders(access!.organizationId, { includeArchived: true }),
    folderAssetCounts(access!.organizationId)
  ]);
  const subtree = collectSubtreeIds(folders, id);
  const held = subtree.reduce((sum, folderId) => sum + (counts[folderId] ?? 0), 0);
  if (held > 0) return NextResponse.json({ error: "FOLDER_NOT_EMPTY", assetCount: held }, { status: 409 });

  const result = await archiveFolder(access!.organizationId, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data);
}
