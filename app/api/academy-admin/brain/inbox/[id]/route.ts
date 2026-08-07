import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { removeInboxItem } from "@/lib/brain/admin";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const result = await removeInboxItem(access!, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
