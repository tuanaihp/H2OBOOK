import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/learning-intelligence/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const access = await resolveOrganizationAccess(auth.user!, organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data: version, error } = await supabase.from("knowledge_space_versions").select("*").eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!version) return NextResponse.json({ error: "VERSION_NOT_FOUND" }, { status: 404 });
  const { data: sections } = await supabase.from("learning_sections").select("*,learning_blocks(*)").eq("version_id", id).order("position", { ascending: true });
  return NextResponse.json({ version, sections: sections ?? [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { organizationId?: string; title?: string; changelog?: string } | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const patch: Record<string, unknown> = {};
  if (body?.title !== undefined) patch.title = body.title;
  if (body?.changelog !== undefined) patch.changelog = body.changelog;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  const { data, error } = await supabase.from("knowledge_space_versions").update(patch).eq("id", id).eq("organization_id", access.organizationId).eq("status", "draft").select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "VERSION_NOT_EDITABLE" }, { status: 409 });
  return NextResponse.json({ ok: true, version: data });
}
