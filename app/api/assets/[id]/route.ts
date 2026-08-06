import { NextResponse } from "next/server";
import { resolveAssetAccess } from "@/lib/assets/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Soft delete only — assets.deleted_at already exists (migration 0011) and every read in this
// module filters is("deleted_at", null), so setting it is what "move to trash" means; there is
// nothing else to build. Restoring clears it. Neither route touches storage_key or the R2 object,
// so a restored asset is exactly the file it was.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAssetAccess(request, { manage: true });
  if (response) return response;
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { error } = await supabase.from("assets").update({ deleted_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", access!.organizationId).is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAssetAccess(request, { manage: true });
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { restore?: boolean } | null;
  if (!body?.restore) return NextResponse.json({ error: "UNSUPPORTED_ACTION" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { error } = await supabase.from("assets").update({ deleted_at: null })
    .eq("id", id).eq("organization_id", access!.organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
