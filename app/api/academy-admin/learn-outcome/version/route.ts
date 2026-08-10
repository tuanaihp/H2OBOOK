import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { archiveVersion, duplicateVersion, preflightVersion, publishVersion } from "@/lib/learn-outcome/admin";

type Body = { action?: string; blueprintId?: string; versionId?: string };

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
    return NextResponse.json(result);
  }
  if (body.action === "publish") {
    if (!body.blueprintId || !body.versionId) return NextResponse.json({ error: "VERSION_REQUIRED" }, { status: 400 });
    const result = await publishVersion(access!, body.blueprintId, body.versionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "archive") {
    if (!body.versionId) return NextResponse.json({ error: "VERSION_REQUIRED" }, { status: 400 });
    const result = await archiveVersion(access!, body.versionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
}
