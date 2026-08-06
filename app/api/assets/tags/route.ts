import { NextResponse } from "next/server";
import { resolveAssetAccess } from "@/lib/assets/request";
import { createTag, listTags } from "@/lib/assets/organization";

export async function GET(request: Request) {
  const { access, response } = await resolveAssetAccess(request);
  if (response) return response;
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "1";
  return NextResponse.json({ tags: await listTags(access!.organizationId, { includeArchived }), canManage: access!.canManage });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAssetAccess(request, { manage: true });
  if (response) return response;
  const body = await request.json().catch(() => null) as { name?: string; color?: string } | null;
  if (typeof body?.name !== "string") return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  const result = await createTag(access!.organizationId, { name: body.name, color: typeof body.color === "string" ? body.color : undefined });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "TAG_SLUG_EXISTS" ? 409 : 400 });
  return NextResponse.json(result.data, { status: 201 });
}
