import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { academyDemoState } from "@/lib/academy/demo-store";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const requestedOrganizationId = new URL(request.url).searchParams.get("organizationId") ?? await configuredAcademyOrganizationId();
  const access = await resolveOrganizationAccess(auth.user!, requestedOrganizationId, ["owner", "admin", "teacher"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ students: academyDemoState().students, mode: "demo" });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const { data: members, error } = await admin.from("organization_members").select("user_id,status,created_at,profiles!inner(id,email,full_name,phone,status)")
    .eq("organization_id", access.organizationId).eq("role", "student").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const userIds = (members ?? []).map((row) => String(row.user_id));
  const { data: skills } = userIds.length ? await admin.from("academy_skill_progress").select("user_id,progress_percent").in("user_id", userIds) : { data: [] };
  const progress = new Map<string, number[]>();
  for (const row of skills ?? []) progress.set(String(row.user_id), [...(progress.get(String(row.user_id)) ?? []), Number(row.progress_percent)]);
  const students = (members ?? []).map((row) => {
    const profileValue = row.profiles as unknown as Record<string, unknown> | Record<string, unknown>[];
    const profile = Array.isArray(profileValue) ? profileValue[0] ?? {} : profileValue ?? {};
    const values = progress.get(String(row.user_id)) ?? [];
    return {
      id: String(row.user_id),
      name: String(profile.full_name ?? "Học viên"),
      email: String(profile.email ?? ""),
      phone: String(profile.phone ?? ""),
      status: row.status === "active" ? "active" : row.status === "paused" ? "paused" : "invited",
      joinedAt: String(row.created_at),
      progress: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
    };
  });
  return NextResponse.json({ students, mode: "production" });
}
