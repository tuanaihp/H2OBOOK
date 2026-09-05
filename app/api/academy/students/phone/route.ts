import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { normalizeVietnamPhone } from "@/lib/auth/phone";
import { configuredAcademyOrganizationId, ensureStudentPhoneAccount } from "@/lib/academy/service";

// Admin creates (or re-issues) a student account that signs in with phone number + 6-digit PIN.
// Role is always "student" and the org is always the configured academy workspace. Optionally
// enrols the student into one class in the same workspace.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null) as { organizationId?: string; name?: string; phone?: string; pin?: string; classId?: string } | null;
  const name = body?.name?.trim();
  const supabasePhone = normalizeVietnamPhone(body?.phone ?? "");
  const pin = (body?.pin ?? "").trim();

  if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  if (!supabasePhone) return NextResponse.json({ error: "INVALID_PHONE", message: "Số điện thoại không hợp lệ. Dùng số di động Việt Nam, ví dụ 0912345678." }, { status: 400 });
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ error: "PIN_MUST_BE_6_DIGITS", message: "Mã PIN phải gồm đúng 6 chữ số." }, { status: 400 });

  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId ?? await configuredAcademyOrganizationId(), ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: "demo", student: { id: `demo_${crypto.randomUUID()}`, name, phone: `+${supabasePhone}`, status: "invited" } }, { status: 201 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });

  try {
    const result = await ensureStudentPhoneAccount(admin, { organizationId: access.organizationId, name, supabasePhone, pin });

    if (body?.classId) {
      const { data: klass } = await admin.from("classes").select("id").eq("id", body.classId).eq("organization_id", access.organizationId).maybeSingle();
      if (!klass) return NextResponse.json({ error: "CLASS_NOT_IN_WORKSPACE" }, { status: 404 });
      const { error: enrolError } = await admin.from("class_members").upsert({
        class_id: body.classId, user_id: result.user.id, role: "student", status: "active", joined_at: new Date().toISOString()
      }, { onConflict: "class_id,user_id" });
      if (enrolError) return NextResponse.json({ error: enrolError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      mode: "production",
      created: result.created,
      student: { id: result.user.id, name, phone: `+${supabasePhone}`, status: "invited" }
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PHONE_STUDENT_CREATE_FAILED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
