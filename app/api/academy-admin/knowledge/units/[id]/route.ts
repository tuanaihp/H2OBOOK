import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { getKnowledgeUnitDetail, saveKnowledgeDraft } from "@/lib/curriculum/knowledge-gateway";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const unit = await getKnowledgeUnitDetail(access!, id);
  if (!unit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ unit });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { title?: string; summary?: string; bodyMarkdown?: string; changeNote?: string; skillCode?: string; authority?: "h2o_official" | "external_reference" | "ai_suggestion" } | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  const result = await saveKnowledgeDraft(access!, id, body);
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: 400 });
}
