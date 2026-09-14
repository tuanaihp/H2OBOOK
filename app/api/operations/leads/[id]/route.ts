import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADMISSION_LEAD_COLUMNS,
  appendLeadNote,
  isLeadStage,
  mapAdmissionLeadRow,
  sanitizeLeadNote,
  type AdmissionLeadRow
} from "@/lib/operations/admission-leads";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Move a lead to another stage and/or append a note. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo || !isSupabaseConfigured()) return NextResponse.json({ error: "DEMO_MODE", message: "Dữ liệu mẫu chỉ được cập nhật trên trình duyệt." }, { status: 409 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "LEAD_NOT_FOUND" }, { status: 404 });

  const body = await request.json().catch(() => null) as { stage?: unknown; note?: unknown } | null;
  if (body?.stage !== undefined && !isLeadStage(body.stage)) return NextResponse.json({ error: "VALID_STAGE_REQUIRED" }, { status: 400 });
  const note = sanitizeLeadNote(body?.note);
  if (note === null) return NextResponse.json({ error: "NOTE_TOO_LONG", message: "Ghi chú tối đa 2000 ký tự." }, { status: 400 });
  if (body?.stage === undefined && !note) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });

  // The lead's organization comes from the database, never from the client.
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const { data: existing } = await admin.from("admission_leads").select("id,organization_id,notes").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "LEAD_NOT_FOUND" }, { status: 404 });
  const organizationId = String(existing.organization_id);
  const access = await resolveOrganizationAccess(auth.user!, organizationId, ["owner", "admin"]);
  if (!access || access.organizationId !== organizationId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (isLeadStage(body?.stage)) patch.stage = body.stage;
  if (note) patch.notes = appendLeadNote(existing.notes as string | null, note);

  // Write through the caller's session so RLS ("admission leads staff manage") is a second guard.
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase
    .from("admission_leads")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select(ADMISSION_LEAD_COLUMNS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "LEAD_UPDATE_FAILED", message: "Không cập nhật được khách tuyển sinh.", retryable: true }, { status: 500 });
  if (!data) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ ok: true, lead: mapAdmissionLeadRow(data as unknown as AdmissionLeadRow) });
}
