import { NextResponse } from "next/server";
import { resolveAssetAccess } from "@/lib/assets/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canEditSavedView } from "@/lib/assets/organization-rules";

// Ownership is re-read from the row before every write. The list endpoint returns a canEdit flag so
// the page can hide controls, but that flag is a convenience for the UI — this is the check.
async function loadView(organizationId: string, viewId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, view: null };
  const { data } = await supabase.from("asset_saved_views").select("id,is_shared,created_by").eq("id", viewId).eq("organization_id", organizationId).maybeSingle();
  return { supabase, view: data ? { isShared: Boolean(data.is_shared), createdBy: data.created_by ? String(data.created_by) : null } : null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAssetAccess(request);
  if (response) return response;
  const { id } = await params;
  const { supabase, view } = await loadView(access!.organizationId, id);
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  if (!view) return NextResponse.json({ error: "VIEW_NOT_FOUND" }, { status: 404 });
  if (!canEditSavedView(access!.role, view, access!.userId)) return NextResponse.json({ error: "VIEW_FORBIDDEN" }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.sortBy === "string") patch.sort_by = body.sortBy;
  if (body.sortDirection === "asc" || body.sortDirection === "desc") patch.sort_direction = body.sortDirection;
  if (body.viewMode === "table" || body.viewMode === "grid") patch.view_mode = body.viewMode;
  if (Array.isArray(body.visibleColumns)) patch.visible_columns = body.visibleColumns.map(String);

  const { error } = await supabase.from("asset_saved_views").update(patch).eq("id", id).eq("organization_id", access!.organizationId);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "VIEW_NAME_EXISTS" : error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/**
 * A saved view holds no content — deleting one loses a shortcut, not an asset — so this is a real
 * delete rather than an archive. Everything it pointed at is untouched.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAssetAccess(request);
  if (response) return response;
  const { id } = await params;
  const { supabase, view } = await loadView(access!.organizationId, id);
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  if (!view) return NextResponse.json({ error: "VIEW_NOT_FOUND" }, { status: 404 });
  if (!canEditSavedView(access!.role, view, access!.userId)) return NextResponse.json({ error: "VIEW_FORBIDDEN" }, { status: 403 });

  const { error } = await supabase.from("asset_saved_views").delete().eq("id", id).eq("organization_id", access!.organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
