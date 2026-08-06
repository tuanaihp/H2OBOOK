import { NextResponse } from "next/server";
import { resolveAssetAccess } from "@/lib/assets/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageAssetOrganization } from "@/lib/assets/organization-rules";
import { queryToFilters } from "@/lib/assets/governance";

// A saved view stores the query, never the result. Nothing here caches assets, so a file uploaded
// after the view was saved appears in it the next time it is opened, without anyone reopening the
// view to refresh it.

export async function GET(request: Request) {
  const { access, response } = await resolveAssetAccess(request);
  if (response) return response;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ views: [] });
  // RLS already limits this to shared views plus the caller's own; the filter here is belt and
  // braces, not the boundary.
  const { data } = await supabase.from("asset_saved_views")
    .select("id,name,filters,is_shared,sort_by,sort_direction,view_mode,visible_columns,created_by,created_at")
    .eq("organization_id", access!.organizationId)
    .order("name", { ascending: true });
  return NextResponse.json({
    views: (data ?? []).map((row) => ({
      id: String(row.id), name: String(row.name), filters: row.filters ?? {},
      isShared: Boolean(row.is_shared), sortBy: String(row.sort_by ?? "created_at"),
      sortDirection: String(row.sort_direction ?? "desc"), viewMode: String(row.view_mode ?? "table"),
      visibleColumns: Array.isArray(row.visible_columns) ? row.visible_columns.map(String) : [],
      createdBy: row.created_by ? String(row.created_by) : null,
      canEdit: row.is_shared ? access!.canManage : String(row.created_by) === access!.userId
    })),
    canManageShared: access!.canManage
  });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAssetAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });

  const isShared = body?.isShared === true;
  // Anyone may keep a private view; only owner/admin/designer may publish one to the workspace,
  // because a shared view becomes part of how everyone navigates the library.
  if (isShared && !canManageAssetOrganization(access!.role)) {
    return NextResponse.json({ error: "SHARED_VIEW_FORBIDDEN" }, { status: 403 });
  }

  // Filters are normalised through the same parser the list endpoint uses, so a saved view can
  // never hold a filter the API would refuse to apply.
  const filters = queryToFilters(new URLSearchParams(Object.entries(body?.filters ?? {}).map(([key, value]) => [key, String(value)])));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase.from("asset_saved_views").insert({
    organization_id: access!.organizationId,
    name,
    filters,
    is_shared: isShared,
    sort_by: typeof body?.sortBy === "string" ? body.sortBy : "created_at",
    sort_direction: body?.sortDirection === "asc" ? "asc" : "desc",
    view_mode: body?.viewMode === "grid" ? "grid" : "table",
    visible_columns: Array.isArray(body?.visibleColumns) ? body.visibleColumns.map(String) : [],
    created_by: access!.userId
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "VIEW_NAME_EXISTS" : error?.message ?? "VIEW_CREATE_FAILED" }, { status: error?.code === "23505" ? 409 : 400 });
  return NextResponse.json({ id: String(data.id) }, { status: 201 });
}
