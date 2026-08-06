import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { createProgram } from "@/lib/career-stages/admin";
import { isStageStatus } from "@/lib/career-stages/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (typeof body?.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  const result = await createProgram(access!, id, {
    slug: typeof body.slug === "string" ? body.slug : body.title,
    title: body.title,
    // parentId set means "this is a module inside that program" — the depth-check trigger in
    // migration 0040 rejects it if the parent already has a parent of its own.
    parentId: typeof body.parentId === "string" ? body.parentId : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    position: typeof body.position === "number" ? body.position : undefined,
    status: isStageStatus(body.status) ? body.status : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data, { status: 201 });
}
