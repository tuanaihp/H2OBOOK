import { NextResponse } from "next/server";
import { getDomainContext, readJsonObject } from "@/lib/domain/http";
import { writeDomainAudit } from "@/lib/domain/audit";

export async function GET(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const ctx = await getDomainContext(request, resource);
  if (ctx.response) return ctx.response;
  try {
    const data = await ctx.service.get(id);
    return data ? NextResponse.json({ data }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch (error) { return NextResponse.json({ error: "DOMAIN_GET_FAILED", detail: String(error) }, { status: 500 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const ctx = await getDomainContext(request, resource);
  if (ctx.response) return ctx.response;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  try {
    const data = await ctx.service.update(id, body);
    await writeDomainAudit({ organizationId: ctx.service.organizationId, actorId: ctx.user.id, action: "update", resource, resourceId: id, metadata: { fields: Object.keys(body) } });
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ error: "DOMAIN_UPDATE_FAILED", detail: String(error) }, { status: 400 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const ctx = await getDomainContext(request, resource);
  if (ctx.response) return ctx.response;
  try {
    await ctx.service.remove(id);
    await writeDomainAudit({ organizationId: ctx.service.organizationId, actorId: ctx.user.id, action: "delete", resource, resourceId: id });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: "DOMAIN_DELETE_FAILED", detail: String(error) }, { status: 400 }); }
}
