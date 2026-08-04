import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { configuredAcademyOrganizationId, joinAcademyAsStudent } from "@/lib/academy/service";

function roleHome(role: string): string {
  return role === "student" ? "/student" : "/dashboard";
}

// H2OBOOK Production Gap Audit §4.2 (P1): the previous version called exchangeCodeForSession()
// without checking its result, so an expired/already-used invite or magic link silently redirected
// to `next` (or /dashboard) with no session and no explanation — the user just looked logged out.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedNext = url.searchParams.get("next");
  const explicitNext = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : null;
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

  // Completes real academy-student registration right here, server-side, for any session that
  // resolves to "student" — covers both a genuine student AND the limbo case (self-registered,
  // no organization_members row yet: getCurrentUser() already defaults that to role "student").
  // Doing this in the callback itself — not only in the login forms — is what makes email
  // confirmation, magic links and OAuth sign-in (Google) all land the student directly in
  // /student, fully joined, no extra manual login step required.
  const user = await getCurrentUser();
  if (user && !user.demo && user.role === "student") {
    const admin = createSupabaseAdminClient();
    const organizationId = await configuredAcademyOrganizationId();
    if (admin && organizationId) {
      await joinAcademyAsStudent(admin, { organizationId, userId: user.id, name: user.name, email: user.email }).catch(() => null);
    }
  }

  // Previously always fell back to /dashboard when no explicit `next` was supplied — for a
  // student session (e.g. Google sign-in from /login with no `next` in the URL) that landed
  // them straight on the demo Admin dashboard instead of /student until middleware's own
  // separate redirect rule happened to catch it. Now the fallback is role-aware from the start.
  const next = explicitNext ?? roleHome(user?.role ?? "student");
  return NextResponse.redirect(new URL(next, url.origin));
}
