import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { getWorkspaceConfig } from "@/lib/mission-workspace/service";
import { addBlock, removeBlock, reorderBlocks, updateBlock } from "@/lib/mission-workspace/admin";
import type { MissionBlockType } from "@/lib/mission-workspace/types";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const params = new URL(request.url).searchParams;
  const journeyVersionId = params.get("journeyVersionId");
  const missionId = params.get("missionId");
  if (!journeyVersionId || !missionId) return NextResponse.json({ error: "VERSION_AND_MISSION_REQUIRED" }, { status: 400 });
  const config = await getWorkspaceConfig(access!.organizationId, journeyVersionId, missionId);
  return NextResponse.json({ config });
}

type Body = {
  action?: string; journeyVersionId?: string; missionId?: string; blockId?: string; orderedBlockIds?: string[];
  block?: { type?: MissionBlockType; label?: string; required?: boolean; bindingId?: string; options?: Record<string, unknown> };
};

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.action || !body.journeyVersionId || !body.missionId) return NextResponse.json({ error: "ACTION_VERSION_MISSION_REQUIRED" }, { status: 400 });

  if (body.action === "addBlock") {
    if (!body.block?.type || !body.block.label) return NextResponse.json({ error: "TYPE_AND_LABEL_REQUIRED" }, { status: 400 });
    const result = await addBlock(access!, body.journeyVersionId, body.missionId, { type: body.block.type, label: body.block.label, required: body.block.required, bindingId: body.block.bindingId, options: body.block.options });
    return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
  }
  if (body.action === "removeBlock") {
    if (!body.blockId) return NextResponse.json({ error: "BLOCK_ID_REQUIRED" }, { status: 400 });
    const result = await removeBlock(access!, body.journeyVersionId, body.missionId, body.blockId);
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
  }
  if (body.action === "reorder") {
    if (!body.orderedBlockIds) return NextResponse.json({ error: "ORDERED_BLOCK_IDS_REQUIRED" }, { status: 400 });
    const result = await reorderBlocks(access!, body.journeyVersionId, body.missionId, body.orderedBlockIds);
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
  }
  if (body.action === "updateBlock") {
    if (!body.blockId) return NextResponse.json({ error: "BLOCK_ID_REQUIRED" }, { status: 400 });
    const result = await updateBlock(access!, body.journeyVersionId, body.missionId, body.blockId, body.block ?? {});
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
}
