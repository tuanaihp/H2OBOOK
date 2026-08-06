import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PAGE_SIZE, queryToFilters, queryToPaging } from "@/lib/assets/governance";

// Asset Governance V1 added filtering and the folder list on top of the existing query. Reads still
// go through the request-scoped client, so RLS is what actually scopes the workspace —
// resolveOrganizationAccess is the first check, not the only one.
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const access = await resolveOrganizationAccess(auth.user!, url.searchParams.get("organizationId") ?? undefined);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ mode: "demo", assets: [], folders: [], counts: null });

  const filters = queryToFilters(url.searchParams);
  const paging = queryToPaging(url.searchParams);

  // Tag is a filter on a join table, so it is resolved to a set of ids first rather than
  // turned into an inner join that would also duplicate rows for multi-tagged assets.
  let tagAssetIds: string[] | null = null;
  if (filters.tagId) {
    const { data: links } = await supabase.from("asset_tag_links").select("asset_id").eq("organization_id", access.organizationId).eq("tag_id", filters.tagId);
    tagAssetIds = (links ?? []).map((row) => String((row as { asset_id: string }).asset_id));
    if (tagAssetIds.length === 0) return NextResponse.json({ mode: "cloud", assets: [], folders: [], counts: { total: 0, unclassified: 0 }, page: paging.page, pageSize: PAGE_SIZE, totalMatching: 0 });
  }

  let query = supabase.from("assets")
    .select("id,title,original_name,asset_type,asset_subtype,mime_type,size_bytes,storage_key,status,quarantine_status,classification_status,review_status,lifecycle_status,rights_status,folder_id,created_at,metadata", { count: "exact" })
    .eq("organization_id", access.organizationId)
    .is("deleted_at", null);

  if (filters.assetType) query = query.eq("asset_type", filters.assetType);
  if (filters.classificationStatus) query = query.eq("classification_status", filters.classificationStatus);
  if (filters.reviewStatus) query = query.eq("review_status", filters.reviewStatus);
  if (filters.lifecycleStatus) query = query.eq("lifecycle_status", filters.lifecycleStatus);
  if (filters.folderId) query = query.eq("folder_id", filters.folderId);
  if (filters.unfiled) query = query.is("folder_id", null);
  if (tagAssetIds) query = query.in("id", tagAssetIds);
  // Searches the curated title and the original filename together: half a library has real names
  // and half is still IMG_4821.jpg, and whoever is looking usually knows only one of the two.
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,original_name.ilike.%${term}%`);
  }

  // Count first with the same predicates, so the page control reflects the filtered set rather
  // than the whole library — a saved view that matches 12 of 4,000 assets must say 12.
  const from = (paging.page - 1) * PAGE_SIZE;
  const [{ data, error, count: matching }, { data: folders }, { count: total }, { count: unclassified }] = await Promise.all([
    query.order(paging.sortBy, { ascending: paging.sortDirection === "asc" }).range(from, from + PAGE_SIZE - 1),
    supabase.from("asset_folders").select("id,name,parent_id").eq("organization_id", access.organizationId).order("position", { ascending: true }),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId).is("deleted_at", null),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId).is("deleted_at", null).eq("classification_status", "unclassified")
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    mode: "cloud",
    assets: data ?? [],
    folders: folders ?? [],
    counts: { total: total ?? 0, unclassified: unclassified ?? 0 },
    page: paging.page,
    pageSize: PAGE_SIZE,
    totalMatching: matching ?? 0
  });
}
