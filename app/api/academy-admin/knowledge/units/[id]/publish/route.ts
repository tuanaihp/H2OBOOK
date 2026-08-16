import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { publishKnowledgeUnit } from "@/lib/curriculum/knowledge-gateway";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { versionId?: string } | null;
  if (!body?.versionId) return NextResponse.json({ error: "VERSION_ID_REQUIRED" }, { status: 400 });
  const result = await publishKnowledgeUnit(access!, id, body.versionId);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
