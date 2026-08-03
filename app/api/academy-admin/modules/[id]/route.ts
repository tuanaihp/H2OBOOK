import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { updateModule, type UpdateModuleInput } from "@/lib/academy-admin/courses";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as UpdateModuleInput | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  const result = await updateModule(id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
