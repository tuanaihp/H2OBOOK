import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { deleteProviderCredential } from "@/lib/enterprise/ai-providers";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const access = await resolveOrganizationAccess(auth.user!, new URL(request.url).searchParams.get("organizationId") ?? undefined, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const result = await deleteProviderCredential(access.organizationId, id);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
