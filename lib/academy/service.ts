import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { academyDemoState, type AcademyApplicationRecord } from "./demo-store";
import {
  academyTargetLabel,
  buildCourseModules,
  catalogProductSlug,
  getAcademyTarget,
  type AcademyTargetType
} from "./catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { escapeEmailHtml, sendEmail } from "@/lib/email/provider";
import { sendTransactionalEmail } from "@/lib/email/transactional";

type AdminClient = SupabaseClient;

export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function resolveAcademyOrganization(admin: AdminClient) {
  const id = process.env.ACADEMY_ORGANIZATION_ID;
  if (id) {
    const { data } = await admin.from("organizations").select("id,name,slug").eq("id", id).eq("status", "active").maybeSingle();
    return data;
  }
  const slug = process.env.ACADEMY_ORGANIZATION_SLUG ?? "thuyh2o-academy";
  const { data } = await admin.from("organizations").select("id,name,slug").eq("slug", slug).eq("status", "active").maybeSingle();
  return data;
}

export async function configuredAcademyOrganizationId() {
  if (!isSupabaseConfigured()) return undefined;
  const admin = createSupabaseAdminClient();
  if (!admin) return undefined;
  const organization = await resolveAcademyOrganization(admin);
  return organization?.id ? String(organization.id) : undefined;
}

export async function ensureAcademyCatalogProduct(admin: AdminClient, organizationId: string, type: AcademyTargetType, slug: string) {
  const target = getAcademyTarget(type, slug);
  if (!target) throw new Error("ACADEMY_TARGET_NOT_FOUND");

  let referenceId: string | null = null;
  if (type === "course") {
    const course = getAcademyTarget("course", slug);
    if (!course) throw new Error("ACADEMY_TARGET_NOT_FOUND");
    const { data: savedCourse, error: courseError } = await admin.from("academy_courses").upsert({
      organization_id: organizationId,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      category: course.category,
      level: course.level,
      duration_label: course.duration,
      format: course.format,
      price: course.price,
      currency: "VND",
      accent: course.accent,
      outcomes: course.outcomes,
      status: "active",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "organization_id,slug" }).select("id").single();
    if (courseError || !savedCourse) throw new Error(courseError?.message ?? "COURSE_SYNC_FAILED");
    referenceId = String(savedCourse.id);

    const modules = buildCourseModules(slug);
    for (const [moduleIndex, module] of modules.entries()) {
      const { data: savedModule, error: moduleError } = await admin.from("academy_course_modules").upsert({
        course_id: referenceId,
        slug: module.slug,
        title: module.title,
        position: moduleIndex,
        status: "published",
        updated_at: new Date().toISOString()
      }, { onConflict: "course_id,slug" }).select("id").single();
      if (moduleError || !savedModule) throw new Error(moduleError?.message ?? "MODULE_SYNC_FAILED");
      const lessonRows = module.lessons.map((lesson, lessonIndex) => ({
        module_id: savedModule.id,
        slug: lesson.slug,
        title: lesson.title,
        description: lesson.description,
        position: lessonIndex,
        duration_seconds: lesson.durationSeconds,
        video_provider: "cloudflare_stream",
        skill_keys: lesson.skillKeys,
        is_preview: lesson.isPreview,
        status: "published",
        content: { summary: lesson.description, checklist: ["Xem bài giảng", "Ghi lại điểm chính", "Hoàn thành phần thực hành"] },
        updated_at: new Date().toISOString()
      }));
      const { error: lessonError } = await admin.from("academy_course_lessons").upsert(lessonRows, { onConflict: "module_id,slug" });
      if (lessonError) throw new Error(lessonError.message);
    }
  }

  const productSlug = catalogProductSlug(type, slug);
  const name = "title" in target ? target.title : target.name;
  const description = target.description;
  const price = target.price;
  const { data: product, error: productError } = await admin.from("products").upsert({
    organization_id: organizationId,
    product_type: type,
    reference_id: referenceId,
    name,
    slug: productSlug,
    description,
    price,
    currency: "VND",
    billing_interval: type === "membership" ? "month" : null,
    status: "active",
    settings: { publicSlug: slug, academy: true },
    updated_at: new Date().toISOString()
  }, { onConflict: "organization_id,slug" }).select("id,organization_id,product_type,reference_id,name,slug,price,currency,billing_interval").single();
  if (productError || !product) throw new Error(productError?.message ?? "PRODUCT_SYNC_FAILED");
  return product;
}

async function findAuthUserByEmail(admin: AdminClient, email: string): Promise<User | null> {
  const normalized = email.toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  throw new Error("AUTH_USER_LOOKUP_LIMIT_REACHED");
}

export async function ensureStudentAuthUser(admin: AdminClient, input: { organizationId: string; name: string; email: string; phone?: string }) {
  const email = input.email.trim().toLowerCase();
  let user = await findAuthUserByEmail(admin, email);
  let invited = false;
  if (!user) {
    const redirectTo = `${appBaseUrl()}/auth/callback?next=/auth/accept-invite`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: input.name.trim(), role: "student" }
    });
    if (error || !data.user) throw new Error(error?.message ?? "AUTH_INVITE_FAILED");
    user = data.user;
    invited = true;
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    email,
    full_name: input.name.trim(),
    phone: input.phone?.trim() || null,
    status: "active",
    updated_at: new Date().toISOString()
  }, { onConflict: "id" });
  if (profileError) throw new Error(profileError.message);
  const { error: memberError } = await admin.from("organization_members").upsert({
    organization_id: input.organizationId,
    user_id: user.id,
    role: "student",
    status: "active"
  }, { onConflict: "organization_id,user_id" });
  if (memberError) throw new Error(memberError.message);
  return { user, invited };
}

export async function grantAcademyAccess(admin: AdminClient, input: {
  organizationId: string;
  userId: string;
  targetType: AcademyTargetType;
  targetSlug: string;
  sourceType: string;
  sourceId?: string | null;
}) {
  const product = await ensureAcademyCatalogProduct(admin, input.organizationId, input.targetType, input.targetSlug);
  const resourceId = String(product.reference_id ?? product.id);
  const trialExpiresAt = input.targetType === "membership" ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null;
  const { data: existing } = await admin.from("entitlements").select("id").eq("user_id", input.userId)
    .eq("resource_type", input.targetType).eq("resource_id", resourceId).eq("status", "active").maybeSingle();
  if (!existing) {
    const { error } = await admin.from("entitlements").insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      resource_type: input.targetType,
      resource_id: resourceId,
      permission: "access",
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      starts_at: new Date().toISOString(),
      expires_at: trialExpiresAt,
      status: "active"
    });
    if (error) throw new Error(error.message);
  }
  if (input.targetType === "membership") {
    const { data: membership } = await admin.from("memberships").select("id").eq("organization_id", input.organizationId).eq("user_id", input.userId).eq("product_id", product.id).in("status", ["trial", "active"]).maybeSingle();
    if (!membership) {
      const { error } = await admin.from("memberships").insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        product_id: product.id,
        plan_name: product.name,
        price: Number(product.price),
        currency: product.currency ?? "VND",
        billing_interval: product.billing_interval ?? "month",
        status: "trial",
        starts_at: new Date().toISOString(),
        renews_at: trialExpiresAt,
        expires_at: trialExpiresAt
      });
      if (error) throw new Error(error.message);
    }
  }
  return product;
}

export async function approveAcademyApplication(applicationId: string, reviewerId: string) {
  if (!isSupabaseConfigured()) {
    const state = academyDemoState();
    const application = state.applications.find((item) => item.id === applicationId);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    application.status = "invited";
    application.reviewedAt = new Date().toISOString();
    application.authUserId = `demo_student_${crypto.randomUUID()}`;
    if (!state.students.some((item) => item.email === application.email)) state.students.unshift({
      id: application.authUserId,
      name: application.name,
      email: application.email,
      phone: application.phone,
      status: "invited",
      joinedAt: new Date().toISOString(),
      progress: 0
    });
    await sendEmail({
      to: application.email,
      subject: `H2OBOOK – Đăng ký ${application.targetName} đã được duyệt`,
      html: `<h2>Chào ${escapeEmailHtml(application.name)},</h2><p>Hồ sơ của bạn đã được duyệt trong Demo Mode.</p>`
    });
    return { application, invited: true, mode: "demo" as const };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
  const { data: application, error } = await admin.from("academy_applications").select("*").eq("id", applicationId).maybeSingle();
  if (error || !application) throw new Error(error?.message ?? "APPLICATION_NOT_FOUND");
  if (["rejected", "converted"].includes(String(application.status))) throw new Error("APPLICATION_NOT_APPROVABLE");

  const auth = await ensureStudentAuthUser(admin, {
    organizationId: String(application.organization_id),
    name: String(application.name),
    email: String(application.email),
    phone: String(application.phone ?? "")
  });
  await grantAcademyAccess(admin, {
    organizationId: String(application.organization_id),
    userId: auth.user.id,
    targetType: application.target_type as AcademyTargetType,
    targetSlug: String(application.target_slug),
    sourceType: "application",
    sourceId: String(application.id)
  });
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin.from("academy_applications").update({
    status: "invited",
    reviewed_by: reviewerId,
    reviewed_at: now,
    auth_user_id: auth.user.id,
    updated_at: now
  }).eq("id", application.id).select("*").single();
  if (updateError) throw new Error(updateError.message);

  const approvalEmail = await sendTransactionalEmail({
    admin,
    organizationId: String(application.organization_id),
    userId: auth.user.id,
    templateKey: "application_approved",
    dedupeKey: String(application.id),
    to: String(application.email),
    subject: `H2OBOOK – Bạn đã được cấp quyền học ${application.target_name}`,
    html: `<h2>Chào ${escapeEmailHtml(application.name)},</h2><p>Hồ sơ đăng ký <strong>${escapeEmailHtml(application.target_name)}</strong> đã được duyệt.</p><p>${auth.invited ? "Hãy mở email mời từ H2OBOOK/Supabase để thiết lập tài khoản." : `Bạn có thể đăng nhập ngay tại <a href="${appBaseUrl()}/login?next=/student">H2OBOOK Student</a>.`}</p>`,
    text: `Hồ sơ ${application.target_name} đã được duyệt. Đăng nhập: ${appBaseUrl()}/login?next=/student`
  }).catch((sendError) => ({ accepted: false, error: sendError instanceof Error ? sendError.message : "EMAIL_FAILED" }));
  return { application: updated, invited: auth.invited, emailAccepted: approvalEmail.accepted, mode: "production" as const };
}

export function mapApplicationRow(row: Record<string, unknown>): AcademyApplicationRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    targetType: row.target_type as AcademyTargetType,
    targetSlug: String(row.target_slug),
    targetName: String(row.target_name),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone ?? ""),
    message: String(row.message ?? ""),
    status: row.status as AcademyApplicationRecord["status"],
    source: String(row.source ?? "academy_public"),
    createdAt: String(row.created_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    authUserId: row.auth_user_id ? String(row.auth_user_id) : undefined
  };
}

export function applicationTargetName(type: AcademyTargetType, slug: string) {
  return academyTargetLabel(type, slug);
}
