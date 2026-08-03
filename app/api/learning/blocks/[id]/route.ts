import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/learning-intelligence/service";

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
  const map: Record<string, string> = { title: "title", visibility: "visibility", required: "required", estimatedMinutes: "estimated_minutes", completionWeight: "completion_weight", payload: "payload", position: "position" };
  for (const [key, column] of Object.entries(map)) if (body?.[key] !== undefined) patch[column] = body[key];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  const { data, error } = await supabase.from("learning_blocks").update(patch).eq("id", id).eq("organization_id", access.organizationId).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "BLOCK_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true, block: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const access = await resolveOrganizationAccess(auth.user!, organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { error } = await supabase.from("learning_blocks").delete().eq("id", id).eq("organization_id", access.organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
