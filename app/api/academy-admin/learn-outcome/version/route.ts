import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { archiveVersion, bulkCloneToStages, deleteDraftVersion, duplicateVersion, preflightVersion, publishVersion } from "@/lib/learn-outcome/admin";
import { emitDomainEvent } from "@/lib/domain/events";

type Body = {
  action?: string; blueprintId?: string; versionId?: string;
  targetStageIds?: string[];
  copyResources?: boolean; copyActions?: boolean; copyWorkspaceBlocks?: boolean; copyPrerequisites?: boolean;
  scope?: string;
};

// One dispatcher route for the version-level commands (docs/learn-outcome-os's "Save Draft /
// Duplicate Version / Preflight / Publish / Archive"), matching the same {action, ...} shape
// app/api/academy-admin/stages/route.ts already uses — Save Draft has no server step of its own,
// every node-level write (POST /api/academy-admin/learn-outcome/node) already writes straight to
// the draft version, so there is nothing else for it to do.
export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.action) return NextResponse.json({ error: "ACTION_REQUIRED" }, { status: 400 });

  if (body.action === "duplicate") {
    if (!body.blueprintId || !body.versionId) return NextResponse.json({ error: "VERSION_REQUIRED" }, { status: 400 });
    const result = await duplicateVersion(access!, body.blueprintId, body.versionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result.data, { status: 201 });
  }
  if (body.action === "preflight") {
    if (!body.versionId) return NextResponse.json({ error: "VERSION_REQUIRED" }, { status: 400 });
    const result = await preflightVersion(access!.organizationId, body.versionId);
    try { await emitDomainEvent({ organizationId: access!.organizationId, actorId: access!.userId, resourceType: "learning_journey_versions", resourceId: body.versionId, eventName: "journey.version_preflighted", payload: { ok: result.ok, blockerCount: result.blockers.length, warningCount: result.warnings.length } }); } catch { /* best-effort analytics */ }
    return NextResponse.json(result);
  }
  if (body.action === "publish") {
    if (!body.blueprintId || !body.versionId) return NextResponse.json({ error: "VERSION_REQUIRED" }, { status: 400 });
    // §13 "Phạm vi áp dụng": no cohort table exists in production (confirmed by audit), so the only
    // real, honest scope is "all active students on this Stage" — every student read of the Journey
    // resolves through the blueprint's current_published_version_id, so this is also just... what
    // publishing already does. Reject any other scope rather than pretend to support it.
    const scope = body.scope ?? "all_active_students";
    if (scope !== "all_active_students") return NextResponse.json({ error: "SCOPE_NOT_SUPPORTED" }, { status: 400 });
    const result = await publishVersion(access!, body.blueprintId, body.versionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    try { await emitDomainEvent({ organizationId: access!.organizationId, actorId: access!.userId, resourceType: "learning_journey_versions", resourceId: body.versionId, eventName: "journey.version_scope_applied", payload: { scope } }); } catch { /* best-effort analytics */ }
    return NextResponse.json({ ok: true });
  }
  if (body.action === "archive") {
    if (!body.versionId) return NextResponse.json({ error: "VERSION_REQUIRED" }, { status: 400 });
    const result = await archiveVersion(access!, body.versionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete") {
    if (!body.versionId) return NextResponse.json({ error: "VERSION_REQUIRED" }, { status: 400 });
    const result = await deleteDraftVersion(access!, body.versionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "bulk-clone") {
    if (!body.versionId || !body.targetStageIds?.length) return NextResponse.json({ error: "TARGETS_REQUIRED" }, { status: 400 });
    const options = {
      copyResources: body.copyResources ?? true,
      copyActions: body.copyActions ?? true,
      copyWorkspaceBlocks: body.copyWorkspaceBlocks ?? true,
      copyPrerequisites: body.copyPrerequisites ?? true
    };
    const result = await bulkCloneToStages(access!, { sourceVersionId: body.versionId, targetStageIds: body.targetStageIds, options });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ results: result.data }, { status: 201 });
  }
  return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
}
