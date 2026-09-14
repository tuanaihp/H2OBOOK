import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { appBaseUrl, approveAcademyApplication, ensureStudentAuthUser } from "@/lib/academy/service";
import { escapeEmailHtml } from "@/lib/email/provider";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import {
  ADMISSION_LEAD_COLUMNS,
  appendLeadNote,
  isApprovableApplication,
  isProvisionedApplication,
  isValidLeadEmail,
  mapAdmissionLeadRow,
  normalizeLeadEmail,
  type AdmissionLeadRow,
  type LinkedApplication
} from "@/lib/operations/admission-leads";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Duyệt → gửi invite" from the CRM. A pending public application goes through the existing
 * approveAcademyApplication flow (account + entitlement + email); any other lead gets a plain
 * student account invite. Either way the lead ends in "enrolled".
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo || !isSupabaseConfigured()) return NextResponse.json({ error: "DEMO_MODE", message: "Không thể gửi lời mời thật trong chế độ demo." }, { status: 409 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "LEAD_NOT_FOUND" }, { status: 404 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const { data: lead } = await admin.from("admission_leads").select(`${ADMISSION_LEAD_COLUMNS},organization_id`).eq("id", id).maybeSingle();
  if (!lead) return NextResponse.json({ error: "LEAD_NOT_FOUND" }, { status: 404 });
  const row = lead as unknown as AdmissionLeadRow & { organization_id: string };
  const organizationId = String(row.organization_id);
  const access = await resolveOrganizationAccess(auth.user!, organizationId, ["owner", "admin"]);
  if (!access || access.organizationId !== organizationId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const email = normalizeLeadEmail(row.email);
  if (!isValidLeadEmail(email)) return NextResponse.json({ error: "LEAD_EMAIL_REQUIRED", message: "Khách chưa có email hợp lệ. Hãy tạo tài khoản bằng số điện thoại trong Academy Admin." }, { status: 400 });
  if (row.stage === "enrolled" || row.stage === "lost") return NextResponse.json({ error: "LEAD_NOT_INVITABLE", message: "Khách đã nhập học hoặc đã đóng." }, { status: 409 });

  const { data: applicationRow } = await admin
    .from("academy_applications")
    .select("id,status")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const application: LinkedApplication | undefined = applicationRow ? { id: String(applicationRow.id), status: String(applicationRow.status) } : undefined;
  if (isProvisionedApplication(application)) return NextResponse.json({ error: "ALREADY_INVITED", message: "Hồ sơ đăng ký của khách đã được cấp tài khoản." }, { status: 409 });

  let invited: boolean;
  let emailAccepted: boolean;
  let via: "application" | "direct";
  try {
    if (isApprovableApplication(application)) {
      const result = await approveAcademyApplication(application.id, auth.user!.id);
      invited = result.invited;
      emailAccepted = "emailAccepted" in result ? Boolean(result.emailAccepted) : false;
      via = "application";
    } else {
      const name = row.name?.trim() || email;
      const account = await ensureStudentAuthUser(admin, { organizationId, name, email, phone: row.phone ?? "" });
      const mail = await sendTransactionalEmail({
        admin,
        organizationId,
        userId: account.user.id,
        templateKey: "admin_student_invite",
        dedupeKey: `${account.user.id}:lead:${row.id}`,
        to: email,
        subject: "H2OBOOK – Tài khoản học viên của bạn đã sẵn sàng",
        html: `<h2>Chào ${escapeEmailHtml(name)},</h2><p>${account.invited ? "Hãy mở email mời xác thực để thiết lập tài khoản." : `Bạn có thể đăng nhập ngay tại <a href="${appBaseUrl()}/login?next=/student">H2OBOOK Student</a>.`}</p>`
      }).catch(() => ({ accepted: false }));
      invited = account.invited;
      emailAccepted = mail.accepted;
      via = "direct";
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "LEAD_INVITE_FAILED", message: "Không gửi được lời mời. Vui lòng thử lại." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const note = `${via === "application" ? "Đã duyệt hồ sơ đăng ký và cấp quyền học" : "Đã tạo tài khoản học viên và gửi lời mời"} từ CRM (${now.slice(0, 10)}).`;
  const { data: updated } = await admin
    .from("admission_leads")
    .update({ stage: "enrolled", notes: appendLeadNote(row.notes, note), updated_at: now })
    .eq("id", row.id)
    .eq("organization_id", organizationId)
    .select(ADMISSION_LEAD_COLUMNS)
    .maybeSingle();
  const linked = application ? { id: application.id, status: "invited" } : undefined;
  return NextResponse.json({
    ok: true,
    via,
    invited,
    emailAccepted,
    lead: mapAdmissionLeadRow((updated ?? { ...row, stage: "enrolled", updated_at: now }) as AdmissionLeadRow, linked)
  });
}
