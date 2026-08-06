import { NextResponse } from "next/server";
import { resolveAssetAccess } from "@/lib/assets/request";
import { createFolder, folderAssetCounts, listFolders } from "@/lib/assets/organization";
import { buildFolderTree } from "@/lib/assets/organization-rules";

export async function GET(request: Request) {
  const { access, response } = await resolveAssetAccess(request);
  if (response) return response;
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "1";
  const [folders, counts] = await Promise.all([
    listFolders(access!.organizationId, { includeArchived }),
    folderAssetCounts(access!.organizationId)
  ]);
  return NextResponse.json({ folders, tree: buildFolderTree(folders, counts), counts, canManage: access!.canManage });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAssetAccess(request, { manage: true });
  if (response) return response;
  const body = await request.json().catch(() => null) as { name?: string; parentId?: string | null } | null;
  if (typeof body?.name !== "string") return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  const result = await createFolder(access!.organizationId, access!.userId, { name: body.name, parentId: body.parentId ?? null });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data, { status: 201 });
}
