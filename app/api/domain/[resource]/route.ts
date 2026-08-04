import { NextResponse } from "next/server";
import { getDomainContext, readJsonObject } from "@/lib/domain/http";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const ctx = await getDomainContext(request, resource);
  if (ctx.response) return ctx.response;
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
  try { return NextResponse.json({ data: await ctx.service.list(limit) }); }
  catch (error) { return NextResponse.json({ error: "DOMAIN_LIST_FAILED", detail: String(error) }, { status: 500 }); }
}

// Every DOMAIN_RESOURCES table already has a capture_domain_event trigger (migration 0007), which
// fires on this insert automatically and records the full row (auth.uid() as actor) into
// domain_events — no manual audit_logs write needed here. See
// docs/DATA_DICTIONARY_MAIN_AUDIT.md §5.2 for why domain_events is now the standard for new work.
export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const ctx = await getDomainContext(request, resource);
  if (ctx.response) return ctx.response;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  try {
    const data = await ctx.service.create(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: "DOMAIN_CREATE_FAILED", detail: String(error) }, { status: 400 }); }
}
