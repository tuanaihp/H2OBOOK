import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// H2OBOOK Production Gap Audit §4.2 (P1): the previous version called exchangeCodeForSession()
// without checking its result, so an expired/already-used invite or magic link silently redirected
// to `next` (or /dashboard) with no session and no explanation — the user just looked logged out.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("next") || "/dashboard";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  const code = url.searchParams.get("code");
  const supabase = await createSupabaseServerClient();

  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/login?error=link_expired", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=link_expired", url.origin));
  }

  await supabase.rpc("claim_my_pending_access");
  return NextResponse.redirect(new URL(next, url.origin));
}
