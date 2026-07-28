import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { isDomainResource, type DomainResource } from "./resource-config";
import { DomainService } from "./service";

export async function getDomainContext(request: Request, resourceValue: string) {
  if (!isDomainResource(resourceValue)) return { response: NextResponse.json({ error: "UNKNOWN_RESOURCE" }, { status: 404 }) } as const;
  const auth = await requireApiUser();
  if (auth.response) return { response: auth.response } as const;
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const service = await DomainService.create(auth.user!, resourceValue as DomainResource, organizationId);
  if (!service) return { response: NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 }) } as const;
  return { response: null, user: auth.user!, service, resource: resourceValue as DomainResource } as const;
}

export async function readJsonObject(request: Request) {
  const value = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
