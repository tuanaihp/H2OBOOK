import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/enterprise/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export async function GET(request: Request) {
  const result = await authenticatePublicApi(request, "books:read");
  if (result.response) return result.response;
  const admin = createSupabaseAdminClient()!;
  const { data, error } = await admin.from("books").select("id,client_key,title,description,status,updated_at").eq("organization_id", result.auth!.organizationId).order("updated_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data, meta: { count: data?.length ?? 0 } });
}
