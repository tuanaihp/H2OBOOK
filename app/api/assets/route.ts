import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const access = await resolveOrganizationAccess(auth.user!, url.searchParams.get("organizationId") ?? undefined);
  if (!access) return NextResponse.json({ error: "WORKSPACE_FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ mode: "demo", assets: [] });
  const { data, error } = await supabase.from("assets")
    .select("id,original_name,mime_type,size_bytes,storage_key,status,quarantine_status,created_at,metadata")
    .eq("organization_id", access.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ mode: "cloud", assets: data ?? [] });
}
