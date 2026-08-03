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
  const { data: space, error } = await supabase.from("knowledge_spaces").select("*").eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!space) return NextResponse.json({ error: "SPACE_NOT_FOUND" }, { status: 404 });
  const { data: versions } = await supabase.from("knowledge_space_versions").select("id,version_number,status,title,changelog,scheduled_at,published_at,created_at").eq("knowledge_space_id", id).order("version_number", { ascending: false });
  return NextResponse.json({ space, versions: versions ?? [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId as string | undefined, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const patch: Record<string, unknown> = {};
  for (const key of ["title", "subtitle", "description", "instructorName", "estimatedMinutes", "heroStyle", "assistantEnabled", "communityEnabled", "certificateEnabled", "sharingEnabled", "tags", "status"] as const) {
    if (body?.[key] === undefined) continue;
    const column = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    patch[column] = body[key];
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  const { data, error } = await supabase.from("knowledge_spaces").update(patch).eq("id", id).eq("organization_id", access.organizationId).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "SPACE_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true, space: data });
}
