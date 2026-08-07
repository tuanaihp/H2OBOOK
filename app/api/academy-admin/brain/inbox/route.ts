import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { enqueueAssets } from "@/lib/brain/admin";
import { loadBrainInbox } from "@/lib/brain/service";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const items = await loadBrainInbox(access!.organizationId);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const assetIds = Array.isArray(body?.assetIds) ? body.assetIds.filter((id): id is string => typeof id === "string" && Boolean(id)) : [];
  if (!assetIds.length) return NextResponse.json({ error: "ASSET_IDS_REQUIRED" }, { status: 400 });
  const result = await enqueueAssets(access!, assetIds);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data, { status: 201 });
}
