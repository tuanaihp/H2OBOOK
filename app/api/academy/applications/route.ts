import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { academyDemoState } from "@/lib/academy/demo-store";
import { getAcademyTarget, type AcademyTargetType } from "@/lib/academy/catalog";
import {
  applicationTargetName,
  configuredAcademyOrganizationId,
  ensureAcademyCatalogProduct,
  mapApplicationRow,
  resolveAcademyOrganization
} from "@/lib/academy/service";
import { escapeEmailHtml, sendEmail } from "@/lib/email/provider";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { syncAdmissionLeadFromApplication } from "@/lib/operations/lead-bridge";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const limit = await rateLimit(requestIdentity(request, "academy-application"), 8, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json().catch(() => null) as {
    targetType?: AcademyTargetType;
    targetSlug?: string;
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    website?: string;
    elapsedMs?: number;
    consent?: boolean;
    source?: string;
    utm?: Record<string, string>;
  } | null;
  const type = body?.targetType;
  const slug = body?.targetSlug?.trim();
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  if (!type || !["course", "membership"].includes(type) || !slug || !getAcademyTarget(type, slug)) return NextResponse.json({ error: "TARGET_NOT_FOUND" }, { status: 404 });
  if (!name || name.length < 2 || name.length > 120) return NextResponse.json({ error: "VALID_NAME_REQUIRED" }, { status: 400 });
  if (!email || !emailPattern.test(email)) return NextResponse.json({ error: "VALID_EMAIL_REQUIRED" }, { status: 400 });
  if (!body?.consent) return NextResponse.json({ error: "CONSENT_REQUIRED" }, { status: 400 });
  if (body.website || Number(body.elapsedMs ?? 0) < 700) return NextResponse.json({ ok: true });
  const targetName = applicationTargetName(type, slug);

  if (!isSupabaseConfigured()) {
    const state = academyDemoState();
    let application = state.applications.find((item) => item.email === email && item.targetType === type && item.targetSlug === slug && !["rejected", "converted"].includes(item.status));
    if (!application) {
      application = {
        id: crypto.randomUUID(),
        organizationId: "workspace_thuyh2o",
        targetType: type,
        targetSlug: slug,
        targetName,
        name,
        email,
        phone: body.phone?.trim() ?? "",
        message: body.message?.trim() ?? "",
        status: "new",
        source: body.source ?? "academy_public",
        createdAt: new Date().toISOString()
      };
      state.applications.unshift(application);
      await sendEmail({
        to: email,
        subject: `H2OBOOK – Đã nhận đăng ký ${targetName}`,
        html: `<h2>Chào ${escapeEmailHtml(name)},</h2><p>H2OBOOK đã nhận đăng ký <strong>${escapeEmailHtml(targetName)}</strong>. Đội ngũ học viện sẽ phản hồi sau khi duyệt hồ sơ.</p>`
      });
    }
    return NextResponse.json({ ok: true, applicationId: application.id, status: application.status, mode: "demo" }, { status: 201 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const organization = await resolveAcademyOrganization(admin);
  if (!organization) return NextResponse.json({ error: "ACADEMY_ORGANIZATION_NOT_CONFIGURED" }, { status: 503 });
  await ensureAcademyCatalogProduct(admin, String(organization.id), type, slug);
  const now = new Date().toISOString();
  const payload = {
    organization_id: organization.id,
    target_type: type,
    target_slug: slug,
    target_name: targetName,
    name,
    email,
    phone: body.phone?.trim() || null,
    message: body.message?.trim() || null,
    status: "new",
    source: body.source ?? "academy_public",
    utm: body.utm ?? {},
    consent: { marketing: true, source: body.source ?? "academy_public", at: now },
    updated_at: now
  };
  const { data, error } = await admin.from("academy_applications").insert(payload).select("id,status").single();
  if (error?.code === "23505") {
    const { data: existing } = await admin.from("academy_applications").select("id,status").eq("organization_id", organization.id)
      .eq("email", email).eq("target_type", type).eq("target_slug", slug).in("status", ["new", "approved", "invited"]).maybeSingle();
    return NextResponse.json({ ok: true, applicationId: existing?.id, status: existing?.status, duplicate: true });
  }
  if (error || !data) return NextResponse.json({ error: error?.message ?? "APPLICATION_CREATE_FAILED" }, { status: 400 });
  await syncAdmissionLeadFromApplication(admin, {
    organizationId: String(organization.id),
    email,
    name,
    phone: body.phone,
    interest: targetName,
    stage: "new",
    note: `Đăng ký công khai: ${targetName}${body.message ? ` — ${body.message.trim()}` : ""}`
  });
  const emailResult = await sendTransactionalEmail({
    admin,
    organizationId: String(organization.id),
    templateKey: "application_received",
    dedupeKey: String(data.id),
    to: email,
    subject: `H2OBOOK – Đã nhận đăng ký ${targetName}`,
    html: `<h2>Chào ${escapeEmailHtml(name)},</h2><p>H2OBOOK đã nhận đăng ký <strong>${escapeEmailHtml(targetName)}</strong>.</p><p>Hồ sơ đang chờ duyệt. Bạn sẽ nhận email tiếp theo ngay khi tài khoản học viên được cấp.</p>`,
    text: `H2OBOOK đã nhận đăng ký ${targetName}. Hồ sơ đang chờ duyệt.`
  }).catch((sendError) => ({ accepted: false, error: sendError instanceof Error ? sendError.message : "EMAIL_FAILED" }));
  return NextResponse.json({ ok: true, applicationId: data.id, status: data.status, emailAccepted: emailResult.accepted, mode: "production" }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const requestedOrganizationId = new URL(request.url).searchParams.get("organizationId") ?? await configuredAcademyOrganizationId();
  const access = await resolveOrganizationAccess(auth.user!, requestedOrganizationId, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ applications: academyDemoState().applications, mode: "demo" });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await admin.from("academy_applications").select("*").eq("organization_id", access.organizationId).order("created_at", { ascending: false }).limit(250);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ applications: (data ?? []).map((row) => mapApplicationRow(row)), mode: "production" });
}
