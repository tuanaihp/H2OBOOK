import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { configuredAcademyOrganizationId, joinAcademyAsStudent } from "@/lib/academy/service";

// Called by the public /signup form right after supabase.auth.signUp() succeeds. Role is never
// accepted from the client — it is always "student", and the target organization is always the
// server-configured academy workspace (ACADEMY_ORGANIZATION_ID/SLUG env var), never a
// client-supplied workspace ID. This is what previously did NOT exist: signUp() alone only
// creates an auth.users row (handle_new_user() only auto-creates a *new* workspace when role is
// left at its "owner" default — it never joins an existing one), so a newly self-registered
// student had no organization_members row at all.
export async function POST() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo || !isSupabaseConfigured()) return NextResponse.json({ ok: true, mode: "demo" });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 503 });
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ACADEMY_ORGANIZATION_NOT_CONFIGURED" }, { status: 503 });

  try {
    await joinAcademyAsStudent(admin, { organizationId, userId: auth.user!.id, name: auth.user!.name, email: auth.user!.email });
    return NextResponse.json({ ok: true, mode: "production" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "STUDENT_REGISTRATION_FAILED" }, { status: 400 });
  }
}
