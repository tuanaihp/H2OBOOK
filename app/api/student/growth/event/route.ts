import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { emitDomainEvent } from "@/lib/domain/events";

// Reuses domain_events (v5/32-.../CLAUDE_INTEGRATION_PROMPT.md §14) — no new event table.
const ALLOWED_EVENTS = new Set(["growth.recommendation.viewed", "growth.recommendation.clicked", "growth.membership_compare.opened"]);

type Body = { eventName?: string; itemId?: string; kind?: string };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ ok: true });
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ ok: true });

  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.eventName || !ALLOWED_EVENTS.has(body.eventName)) return NextResponse.json({ error: "UNKNOWN_EVENT" }, { status: 400 });

  await emitDomainEvent({ organizationId, actorId: auth.user!.id, resourceType: "products", resourceId: body.itemId ?? null, eventName: body.eventName, payload: { kind: body.kind ?? null } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
