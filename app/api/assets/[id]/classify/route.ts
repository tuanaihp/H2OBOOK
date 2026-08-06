import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ASSET_TYPES, CLASSIFICATION_STATUSES, LIFECYCLE_STATUSES, REVIEW_STATUSES, RIGHTS_STATUSES } from "@/lib/assets/governance";

const inList = (value: unknown, allowed: readonly string[]) => typeof value === "string" && allowed.includes(value) ? value : undefined;

// Classifying an asset. Writes go through the request-scoped client so the admin/designer policy
// from migration 0037 is enforced by the database, and the assets_domain_event trigger records the
// before/after itself — which is why there is no audit write here and no asset_audit_logs table.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const access = await resolveOrganizationAccess(auth.user!, url.searchParams.get("organizationId") ?? undefined, ["owner", "admin", "designer"]);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim() || null;
  if (typeof body.description === "string") patch.description = body.description.trim() || null;
  if (typeof body.assetSubtype === "string") patch.asset_subtype = body.assetSubtype.trim() || null;
  if (body.folderId === null || typeof body.folderId === "string") patch.folder_id = body.folderId || null;

  const assetType = inList(body.assetType, ASSET_TYPES);
  if (assetType) patch.asset_type = assetType;
  const classification = inList(body.classificationStatus, CLASSIFICATION_STATUSES);
  if (classification) patch.classification_status = classification;
  const review = inList(body.reviewStatus, REVIEW_STATUSES);
  if (review) patch.review_status = review;
  const lifecycle = inList(body.lifecycleStatus, LIFECYCLE_STATUSES);
  if (lifecycle) patch.lifecycle_status = lifecycle;
  const rights = inList(body.rightsStatus, RIGHTS_STATUSES);
  if (rights) patch.rights_status = rights;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });

  // Giving an asset a type is what classifying it means, so the status follows rather than being a
  // separate box someone has to remember to tick.
  if (assetType && !classification) patch.classification_status = "classified";

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { error } = await supabase.from("assets").update(patch).eq("id", id).eq("organization_id", access.organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
