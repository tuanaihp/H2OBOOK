import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { recordResourceProgress, setResourceBookmark } from "@/lib/curriculum/reader-context";
import { emitDomainEvent } from "@/lib/domain/events";

type Body = { resourceType?: string; resourceId?: string; progressPercent?: number; bookmarked?: boolean; missionId?: string | null };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId || auth.user!.demo) return NextResponse.json({ ok: true });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.resourceType || !body.resourceId) return NextResponse.json({ error: "RESOURCE_REQUIRED" }, { status: 400 });

  if (body.bookmarked !== undefined) {
    const result = await setResourceBookmark(organizationId, auth.user!.id, body.resourceType, body.resourceId, body.bookmarked);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    void emitDomainEvent({ organizationId, actorId: auth.user!.id, resourceType: body.resourceType, resourceId: body.resourceId, eventName: "learning.resource_bookmarked", payload: { bookmarked: body.bookmarked } }).catch(() => {});
  }
  if (body.progressPercent !== undefined) {
    const result = await recordResourceProgress(organizationId, auth.user!.id, body.resourceType, body.resourceId, body.progressPercent);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    if (body.progressPercent >= 100 && body.missionId) {
      void emitDomainEvent({ organizationId, actorId: auth.user!.id, resourceType: "learning_journey_missions", resourceId: body.missionId, eventName: "learning.resource_returned_to_mission", payload: { resourceId: body.resourceId } }).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true });
}
