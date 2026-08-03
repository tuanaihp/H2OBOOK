import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/learning-intelligence/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { organizationId?: string; title?: string; description?: string; icon?: string; required?: boolean } | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!body?.title?.trim()) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data: version } = await supabase.from("knowledge_space_versions").select("id,status").eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (!version) return NextResponse.json({ error: "VERSION_NOT_FOUND" }, { status: 404 });
  if (version.status !== "draft") return NextResponse.json({ error: "VERSION_NOT_EDITABLE" }, { status: 409 });
  const { count } = await supabase.from("learning_sections").select("id", { count: "exact", head: true }).eq("version_id", id);

  const { data, error } = await supabase.from("learning_sections").insert({
    organization_id: access.organizationId, version_id: id, title: body.title.trim(), description: body.description ?? "", icon: body.icon ?? "", required: body.required ?? true, position: count ?? 0
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, section: data }, { status: 201 });
}
