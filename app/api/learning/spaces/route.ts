import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES, slugify } from "@/lib/learning-intelligence/service";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const access = await resolveOrganizationAccess(auth.user!, organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase
    .from("knowledge_spaces")
    .select("id,slug,title,space_type,status,estimated_minutes,updated_at,active_version_id,content_item_id,academy_course_lessons(title,module_id)")
    .eq("organization_id", access.organizationId)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ spaces: data ?? [], organizationId: access.organizationId });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { organizationId?: string; contentItemId?: string; title?: string; spaceType?: string; instructorName?: string } | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const title = body?.title?.trim();
  if (!title || !body?.contentItemId) return NextResponse.json({ error: "TITLE_AND_CONTENT_ITEM_REQUIRED" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const slug = slugify(title);
  const code = `space-${slug}`;
  const { data: space, error } = await supabase.from("knowledge_spaces").insert({
    organization_id: access.organizationId,
    content_item_id: body.contentItemId,
    code, slug, title,
    space_type: body.spaceType ?? "digital_textbook",
    instructor_name: body.instructorName ?? "",
    status: "draft"
  }).select("id,slug,title").single();
  if (error || !space) return NextResponse.json({ error: error?.message ?? "SPACE_CREATE_FAILED" }, { status: 400 });

  const { data: version, error: versionError } = await supabase.from("knowledge_space_versions").insert({
    organization_id: access.organizationId, knowledge_space_id: space.id, version_number: 1, status: "draft", title: `${title} — v1`, created_by: auth.user!.id
  }).select("id").single();
  if (versionError || !version) return NextResponse.json({ error: versionError?.message ?? "VERSION_CREATE_FAILED" }, { status: 400 });

  return NextResponse.json({ ok: true, space, versionId: version.id }, { status: 201 });
}
