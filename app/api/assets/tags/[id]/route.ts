import { NextResponse } from "next/server";
import { resolveAssetAccess } from "@/lib/assets/request";
import { setTagOnAssets, updateTag } from "@/lib/assets/organization";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAssetAccess(request, { manage: true });
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { name?: string; color?: string | null; archived?: boolean } | null;
  if (!body) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });
  const result = await updateTag(access!.organizationId, id, {
    name: typeof body.name === "string" ? body.name : undefined,
    color: body.color === undefined ? undefined : body.color,
    archived: typeof body.archived === "boolean" ? body.archived : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "TAG_SLUG_EXISTS" ? 409 : 400 });
  return NextResponse.json({ ok: true });
}

/**
 * Applies or removes this tag across a set of assets. Tagging is curation of shared structure, so
 * it needs the same role as creating the tag — otherwise anyone could reshape how the workspace
 * finds its material without being allowed to name the categories.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAssetAccess(request, { manage: true });
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { assetIds?: string[]; attach?: boolean } | null;
  if (!Array.isArray(body?.assetIds) || body.assetIds.length === 0) return NextResponse.json({ error: "NO_ASSETS_SELECTED" }, { status: 400 });
  const result = await setTagOnAssets(access!.organizationId, id, body.assetIds.map(String), body.attach !== false);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data);
}
