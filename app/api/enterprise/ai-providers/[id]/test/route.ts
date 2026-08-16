import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { testProviderCredential } from "@/lib/enterprise/ai-providers";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { organizationId?: string } | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const result = await testProviderCredential(access.organizationId, id);
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: 400 });
}
