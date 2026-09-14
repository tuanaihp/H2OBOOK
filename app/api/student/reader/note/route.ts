import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { listResourceNotes, saveResourceNote } from "@/lib/curriculum/reader-context";
import { emitDomainEvent } from "@/lib/domain/events";

type Body = { resourceType?: string; resourceId?: string; missionId?: string | null; title?: string; body?: string };

/** The student's own notes for one resource (newest first) — same trust boundary as POST. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId || auth.user!.demo) return NextResponse.json({ notes: [] });
  const params = new URL(request.url).searchParams;
  const resourceType = params.get("resourceType");
  const resourceId = params.get("resourceId");
  if (!resourceType || !resourceId) return NextResponse.json({ error: "RESOURCE_REQUIRED" }, { status: 400 });
  const notes = await listResourceNotes(organizationId, auth.user!.id, resourceType, resourceId);
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.resourceType || !body.resourceId || !body.body?.trim()) return NextResponse.json({ error: "NOTE_REQUIRED" }, { status: 400 });

  const result = await saveResourceNote(organizationId, auth.user!.id, { resourceType: body.resourceType, resourceId: body.resourceId, missionId: body.missionId, title: body.title ?? "", body: body.body });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  void emitDomainEvent({ organizationId, actorId: auth.user!.id, resourceType: body.resourceType, resourceId: body.resourceId, eventName: "learning.note_saved", payload: { noteId: result.data.id, missionId: body.missionId ?? null } }).catch(() => {});
  return NextResponse.json({ ok: true, id: result.data.id });
}
