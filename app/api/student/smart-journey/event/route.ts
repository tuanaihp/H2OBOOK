import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { emitDomainEvent } from "@/lib/domain/events";

// UI-only analytics for the Smart Journey Shell (docs/smart-journey-v3 §14) — reuses domain_events,
// no new table. Fire-and-forget from the client; an allowlist keeps this from becoming an arbitrary
// event-injection endpoint.
const ALLOWED_EVENTS = new Set([
  "journey.mode_changed", "journey.view_changed", "journey.mission_previewed",
  "journey.mission_workspace_opened", "journey.list_filtered", "journey.action_queue_viewed"
]);

type Body = { eventName?: string; missionId?: string; payload?: Record<string, unknown> };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ ok: true });
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ ok: true });

  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.eventName || !ALLOWED_EVENTS.has(body.eventName)) return NextResponse.json({ error: "UNKNOWN_EVENT" }, { status: 400 });

  await emitDomainEvent({
    organizationId, actorId: auth.user!.id, resourceType: "learning_journey_missions",
    resourceId: body.missionId ?? null, eventName: body.eventName, payload: body.payload ?? {}
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
