import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { syncContentCatalog } from "@/lib/academy-control/admin";

// Re-runs migration 0041's h2obook_sync_content_catalog for this organization — the substitute for
// per-source-table write-through triggers (see the migration's comment on why that was skipped).
export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const result = await syncContentCatalog(access!);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
