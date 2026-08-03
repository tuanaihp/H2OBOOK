import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/learning-intelligence/service";

// Publishes now, or schedules for a future publish (handled server-side by
// learning_publish_due_space_versions, a service-role/cron-only RPC — never called from here).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { organizationId?: string; scheduledAt?: string } | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data, error } = await supabase.rpc("learning_publish_space_version", {
    p_version_id: id,
    p_scheduled_at: body?.scheduledAt ?? null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, version: data });
}
