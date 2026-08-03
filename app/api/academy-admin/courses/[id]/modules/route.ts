import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { createModule } from "@/lib/academy-admin/courses";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { title?: string } | null;
  if (!body?.title?.trim()) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  const result = await createModule(access!, id, body.title);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
