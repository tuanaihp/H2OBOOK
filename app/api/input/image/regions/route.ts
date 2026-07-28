import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json() as {
    organizationId?: string;
    assetId?: string;
    bookClientKey?: string;
    regions?: Array<{ id?: string; kind?: string; order?: number; x?: number; y?: number; width?: number; height?: number; label?: string }>;
  };
  if (!body.assetId || !Array.isArray(body.regions)) return NextResponse.json({ error: "IMAGE_REGIONS_REQUIRED" }, { status: 400 });
  const access = await resolveOrganizationAccess(auth.user!, body.organizationId, ["owner","admin","designer","partner","teacher"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data: asset } = await supabase.from("assets").select("id").eq("id", body.assetId).eq("organization_id", access.organizationId).is("deleted_at", null).maybeSingle();
  if (!asset) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
  const normalized = body.regions.map((region, index) => ({
    id: region.id ?? null,
    kind: ["text","image","ignore"].includes(region.kind ?? "") ? region.kind : "ignore",
    order: Number.isFinite(region.order) ? Math.max(0, Math.round(region.order!)) : index,
    x: Math.max(0, Number(region.x ?? 0)),
    y: Math.max(0, Number(region.y ?? 0)),
    width: Math.max(1, Number(region.width ?? 1)),
    height: Math.max(1, Number(region.height ?? 1)),
    label: region.label?.slice(0, 200) || null,
  }));
  const { data: saved, error } = await supabase.rpc("replace_image_import_regions", {
    p_organization_id: access.organizationId,
    p_asset_id: body.assetId,
    p_book_client_key: body.bookClientKey ?? null,
    p_regions: normalized,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ saved: Number(saved ?? normalized.length) });
}
