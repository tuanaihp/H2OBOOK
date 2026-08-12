import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { saveDraftUiConfig } from "@/lib/academy-control/admin";
import { loadStageUiConfig } from "@/lib/academy-control/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const result = await loadStageUiConfig(access!.organizationId, id);
  return NextResponse.json(result);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const rawItems = Array.isArray(body?.topLevel) ? body.topLevel : [];
  const topLevel = rawItems
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).key === "string" && typeof (item as Record<string, unknown>).label === "string")
    .map((item) => ({
      key: String(item.key),
      label: String(item.label),
      icon: typeof item.icon === "string" ? item.icon : undefined,
      route: typeof item.route === "string" ? item.route : undefined,
      visible: item.visible !== false,
      locked: item.locked === true,
      // preview/featured (v5/34-.../CLAUDE_INTEGRATION_PROMPT.md "Giao diện học viên" reframe):
      // "Cho xem thử" and "Nổi bật" for each of the 3 real surfaces.
      preview: item.preview === true,
      featured: item.featured === true,
      requiredStage: typeof item.requiredStage === "number" ? item.requiredStage : null
    }));
  const result = await saveDraftUiConfig(access!, id, {
    topLevel,
    notes: typeof body?.notes === "string" ? body.notes : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data, { status: 201 });
}
