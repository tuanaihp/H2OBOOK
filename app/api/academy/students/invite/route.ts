import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { academyDemoState } from "@/lib/academy/demo-store";
import { getAcademyTarget, type AcademyTargetType } from "@/lib/academy/catalog";
import { configuredAcademyOrganizationId, ensureStudentAuthUser, grantAcademyAccess } from "@/lib/academy/service";
import { escapeEmailHtml, sendEmail } from "@/lib/email/provider";
import { sendTransactionalEmail } from "@/lib/email/transactional";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { organizationId?: string; name?: string; email?: string; phone?: string; targetType?: AcademyTargetType; targetSlug?: string } | null;
  const requestedOrganizationId = body?.organizationId ?? await configuredAcademyOrganizationId();
  const access = await resolveOrganizationAccess(auth.user!, requestedOrganizationId, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "VALID_NAME_AND_EMAIL_REQUIRED" }, { status: 400 });
  if (body?.targetType && (!body.targetSlug || !getAcademyTarget(body.targetType, body.targetSlug))) return NextResponse.json({ error: "TARGET_NOT_FOUND" }, { status: 404 });

  if (!isSupabaseConfigured()) {
    const state = academyDemoState();
    let student = state.students.find((item) => item.email === email);
    student ??= { id: `demo_student_${crypto.randomUUID()}`, name, email, phone: body?.phone?.trim() ?? "", status: "invited", joinedAt: new Date().toISOString(), progress: 0 };
    if (!state.students.some((item) => item.id === student!.id)) state.students.unshift(student);
    await sendEmail({ to: email, subject: "H2OBOOK – Lời mời học viên (Demo)", html: `<h2>Chào ${escapeEmailHtml(name)},</h2><p>Tài khoản học viên đã được mô phỏng trong Demo Mode.</p>` });
    return NextResponse.json({ ok: true, student, invited: true, mode: "demo" }, { status: 201 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  try {
    const result = await ensureStudentAuthUser(admin, { organizationId: access.organizationId, name, email, phone: body?.phone });
    if (body?.targetType && body.targetSlug) await grantAcademyAccess(admin, {
      organizationId: access.organizationId,
      userId: result.user.id,
      targetType: body.targetType,
      targetSlug: body.targetSlug,
      sourceType: "admin_invite"
    });
    const inviteEmail = await sendTransactionalEmail({
      admin,
      organizationId: access.organizationId,
      userId: result.user.id,
      templateKey: "admin_student_invite",
      dedupeKey: `${result.user.id}:${body?.targetType ?? "account"}:${body?.targetSlug ?? "base"}`,
      to: email,
      subject: "H2OBOOK – Tài khoản học viên của bạn đã sẵn sàng",
      html: `<h2>Chào ${escapeEmailHtml(name)},</h2><p>${result.invited ? "Hãy mở email mời xác thực để thiết lập tài khoản." : "Quyền học mới đã được thêm vào tài khoản hiện có của bạn."}</p>`
    }).catch((sendError) => ({ accepted: false, error: sendError instanceof Error ? sendError.message : "EMAIL_FAILED" }));
    return NextResponse.json({ ok: true, student: { id: result.user.id, name, email, phone: body?.phone ?? "", status: "invited", joinedAt: new Date().toISOString(), progress: 0 }, invited: result.invited, emailAccepted: inviteEmail.accepted, mode: "production" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "STUDENT_INVITE_FAILED" }, { status: 400 });
  }
}
