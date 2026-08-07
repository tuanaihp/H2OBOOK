import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { publishStage } from "@/lib/career-stages/admin";
import { runStagePreflight } from "@/lib/academy-control/health";

// The client already runs preflight and disables Publish on a fail — this route re-checks
// server-side so a stale UI cannot bypass the gate by calling the endpoint directly.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const preflight = await runStagePreflight(access!.organizationId, id);
  if (!preflight.ok) return NextResponse.json({ error: "PREFLIGHT_FAILED", preflight }, { status: 400 });
  const result = await publishStage(access!, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
