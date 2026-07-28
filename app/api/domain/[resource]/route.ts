import { NextResponse } from "next/server";
import { getDomainContext, readJsonObject } from "@/lib/domain/http";
import { writeDomainAudit } from "@/lib/domain/audit";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const ctx = await getDomainContext(request, resource);
  if (ctx.response) return ctx.response;
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
  try { return NextResponse.json({ data: await ctx.service.list(limit) }); }
  catch (error) { return NextResponse.json({ error: "DOMAIN_LIST_FAILED", detail: String(error) }, { status: 500 }); }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const ctx = await getDomainContext(request, resource);
  if (ctx.response) return ctx.response;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  try {
    const data = await ctx.service.create(body);
    await writeDomainAudit({ organizationId: ctx.service.organizationId, actorId: ctx.user.id, action: "create", resource, resourceId: String(data.id ?? ""), metadata: { source: "domain-api" } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: "DOMAIN_CREATE_FAILED", detail: String(error) }, { status: 400 }); }
}
