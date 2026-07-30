import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { academyDemoState } from "@/lib/academy/demo-store";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { organizationId?: string; action?: "pause" | "activate" } | null;
  if (!body?.action || !["pause", "activate"].includes(body.action)) return NextResponse.json({ error: "VALID_ACTION_REQUIRED" }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId ?? await configuredAcademyOrganizationId(), ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSupabaseConfigured()) {
    const student = academyDemoState().students.find((item) => item.id === id);
    if (!student) return NextResponse.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
    student.status = body.action === "activate" ? "active" : "invited";
    return NextResponse.json({ ok: true, student, mode: "demo" });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return NextResponse.json({ error: "VALID_STUDENT_ID_REQUIRED" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const status = body.action === "activate" ? "active" : "paused";
  const { data, error } = await admin.from("organization_members").update({ status }).eq("organization_id", access.organizationId).eq("user_id", id).eq("role", "student").select("user_id,status").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
  await admin.from("profiles").update({ status: body.action === "activate" ? "active" : "paused", updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true, student: data, mode: "production" });
}
