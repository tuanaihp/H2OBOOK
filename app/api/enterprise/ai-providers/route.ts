import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createProviderCredential, listProviderCredentials, AI_PROVIDER_KINDS, type AiProviderKind } from "@/lib/enterprise/ai-providers";

type Body = { organizationId?: string; provider?: AiProviderKind; label?: string; apiKey?: string; capabilities?: string[] };

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const access = await resolveOrganizationAccess(auth.user!, new URL(request.url).searchParams.get("organizationId") ?? undefined, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const credentials = await listProviderCredentials(access.organizationId);
  return NextResponse.json({ credentials });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as Body | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  if (!body?.provider || !AI_PROVIDER_KINDS.includes(body.provider) || !body.apiKey?.trim()) return NextResponse.json({ error: "PROVIDER_AND_API_KEY_REQUIRED" }, { status: 400 });
  const result = await createProviderCredential(access.organizationId, auth.user!.id, { provider: body.provider, label: body.label ?? "", apiKey: body.apiKey, capabilities: body.capabilities ?? [] });
  return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
}
