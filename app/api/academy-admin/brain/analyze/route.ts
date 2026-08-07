import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { reanalyzeInboxItems } from "@/lib/brain/admin";

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const itemIds = Array.isArray(body?.itemIds) ? body.itemIds.filter((id): id is string => typeof id === "string" && Boolean(id)) : [];
  if (!itemIds.length) return NextResponse.json({ error: "ITEM_IDS_REQUIRED" }, { status: 400 });
  const result = await reanalyzeInboxItems(access!, itemIds);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data);
}
