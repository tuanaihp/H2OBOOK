import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { publicCourses, membershipPlans } from "@/lib/public-site/content";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { configuredAcademyOrganizationId, ensureAcademyCatalogProduct } from "@/lib/academy/service";
import { isSupabaseConfigured } from "@/lib/runtime-config";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { organizationId?: string } | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId ?? await configuredAcademyOrganizationId(), ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, courses: publicCourses.length, memberships: membershipPlans.length, mode: "demo" });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  for (const course of publicCourses) await ensureAcademyCatalogProduct(admin, access.organizationId, "course", course.slug);
  for (const plan of membershipPlans) await ensureAcademyCatalogProduct(admin, access.organizationId, "membership", plan.id);
  return NextResponse.json({ ok: true, courses: publicCourses.length, memberships: membershipPlans.length, mode: "production" });
}
