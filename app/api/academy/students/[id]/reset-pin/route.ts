import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { configuredAcademyOrganizationId, resetStudentPin } from "@/lib/academy/service";

// Admin re-issues a student's 6-digit PIN (the "forgot PIN" path). Forces another change on the
// student's next login. Only touches students of the caller's academy workspace.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { organizationId?: string; pin?: string } | null;
  const pin = (body?.pin ?? "").trim();
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ error: "PIN_MUST_BE_6_DIGITS", message: "Mã PIN phải gồm đúng 6 chữ số." }, { status: 400 });
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return NextResponse.json({ error: "VALID_STUDENT_ID_REQUIRED" }, { status: 400 });

  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId ?? await configuredAcademyOrganizationId(), ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, mode: "demo" });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });

  const { data: member } = await admin.from("organization_members").select("user_id")
    .eq("organization_id", access.organizationId).eq("user_id", id).eq("role", "student").maybeSingle();
  if (!member) return NextResponse.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });

  try {
    await resetStudentPin(admin, id, pin);
    return NextResponse.json({ ok: true, mode: "production" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PIN_RESET_FAILED" }, { status: 400 });
  }
}
