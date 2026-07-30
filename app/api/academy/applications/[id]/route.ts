import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { academyDemoState } from "@/lib/academy/demo-store";
import { approveAcademyApplication } from "@/lib/academy/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { action?: "approve" | "reject" } | null;
  if (!body?.action || !["approve", "reject"].includes(body.action)) return NextResponse.json({ error: "VALID_ACTION_REQUIRED" }, { status: 400 });

  let organizationId: string | undefined;
  if (isSupabaseConfigured()) {
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
    const { data } = await admin.from("academy_applications").select("organization_id").eq("id", id).maybeSingle();
    organizationId = data?.organization_id ? String(data.organization_id) : undefined;
  } else {
    organizationId = academyDemoState().applications.find((item) => item.id === id)?.organizationId;
  }
  if (!organizationId) return NextResponse.json({ error: "APPLICATION_NOT_FOUND" }, { status: 404 });
  const access = await resolveOrganizationAccess(auth.user!, organizationId, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (body.action === "approve") {
    try {
      const result = await approveAcademyApplication(id, auth.user!.id);
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "APPROVAL_FAILED" }, { status: 400 });
    }
  }

  if (!isSupabaseConfigured()) {
    const application = academyDemoState().applications.find((item) => item.id === id);
    if (application) { application.status = "rejected"; application.reviewedAt = new Date().toISOString(); }
    return NextResponse.json({ ok: true, application, mode: "demo" });
  }
  const admin = createSupabaseAdminClient()!;
  const { data, error } = await admin.from("academy_applications").update({ status: "rejected", reviewed_by: auth.user!.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).select("id,status").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, application: data, mode: "production" });
}
