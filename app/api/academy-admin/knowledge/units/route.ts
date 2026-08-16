import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { createKnowledgeUnit, listKnowledgeUnits, type CreateKnowledgeUnitInput, type KnowledgeEditorialStatus } from "@/lib/curriculum/knowledge-gateway";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const params = new URL(request.url).searchParams;
  const units = await listKnowledgeUnits(access!, {
    q: params.get("q") ?? undefined,
    docType: params.get("docType") ?? undefined,
    editorialStatus: (params.get("editorialStatus") as KnowledgeEditorialStatus | null) ?? undefined
  });
  return NextResponse.json({ units });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Partial<CreateKnowledgeUnitInput> | null;
  if (!body?.title || !body.bodyMarkdown || !body.docType) return NextResponse.json({ error: "TITLE_BODY_DOCTYPE_REQUIRED" }, { status: 400 });
  const result = await createKnowledgeUnit(access!, { title: body.title, summary: body.summary, bodyMarkdown: body.bodyMarkdown, docType: body.docType, tags: body.tags, authority: body.authority, skillCode: body.skillCode });
  return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
}
