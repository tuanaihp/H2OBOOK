import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/dev" holds the typography fixture only. It is listed here so it can be opened after deploy to
// check Vietnamese diacritics without the student redirect bouncing it back to /student; the page
// itself is noindex and reads no data.
//
// "/verify-outcome" is listed in its own right rather than riding on "/verify". These were matched
// with a bare startsWith, so any path merely beginning with these characters counted as public —
// which silently made the whole /academy-admin tree public off the back of "/academy". Matching is
// now segment-bounded (see isPathUnder), so a sibling route can never inherit a neighbour's
// exemption; the two routes that were relying on the loose behaviour are /verify-outcome, which
// genuinely is a public unauthenticated certificate page and so is named here, and /academy-admin,
// which never should have been.
// The three /api/reader and /api/analytics entries below serve the public reader, which is itself
// public (/reader is listed here too). They were being redirected to /login, so a signed-out
// reader could not load its campaign, could not submit a lead and reported no analytics at all —
// the redirect answered 307 and the fetch silently failed. Each of the three is unauthenticated by
// design, rate limited, and strips PII; the admin siblings stay out of this list on purpose:
// /api/analytics/report requires owner/admin/teacher, and PUT /api/reader/campaign/[id] does its
// own requireApiUser + resolveOrganizationAccess, so listing the prefix does not expose the write.
const publicPrefixes = ["/login", "/signup", "/auth", "/portal", "/reader", "/academy", "/verify", "/verify-outcome", "/unauthorized", "/dev", "/api/public", "/api/health", "/api/readiness", "/api/payments/checkout", "/api/payments/webhook", "/api/academy/applications", "/api/academy/catalog/resolve", "/api/reader/campaign", "/api/reader/leads", "/api/analytics/events"];

function isPathUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// H2OBOOK Production Gap Audit §4.1 (P0): these routes are unambiguously System/Platform Admin
// surfaces with no plausible non-admin/owner use case — unlike Create/Teach/Business tool routes
// (books, editor, classes, assignments, templates, etc.), which stay reachable by whatever roles
// already use them today, per the audit's explicit instruction not to break existing navigation
// with a blanket deny. See the audit doc's §4.1/§6 for the full reasoning and what was
// deliberately left out of this list.
// /academy-admin joins this list now that segment-bounded matching stops it being treated as
// public. Its root page already re-resolved the role server-side, but every child under it is a
// client component with no server guard of its own, so an unauthenticated visitor was served the
// admin shell — no data, since the APIs check the role independently, but the wrong answer.
const adminOnlyPrefixes = ["/admin", "/academy-admin", "/platform-admin", "/security", "/enterprise", "/integrations", "/cloud-sync", "/settings", "/smart-settings", "/assist-control", "/offline"];

function buildCsp(nonce: string) {
  const production = process.env.NODE_ENV === "production";
  // Next.js can only stamp a CSP nonce onto markup it renders per request. Statically
  // prerendered routes (65 of 133 here) are built ahead of time with no nonce at all, so a
  // nonce-based script-src blocked every script on them in production — including the inline
  // RSC payload — and those pages never hydrated. Since specifying a nonce also makes the
  // browser ignore 'unsafe-inline', the nonce has to come out of script-src, not just
  // 'strict-dynamic'. Same-origin and inline scripts are allowed instead; external script
  // hosts and eval remain blocked in production.
  const scriptSrc = production
    ? `'self' 'unsafe-inline'`
    : `'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://images.unsplash.com https://plus.unsplash.com https://*.r2.dev",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com https://*.videodelivery.net https://*.cloudflarestream.com",
    "media-src 'self' blob: https://*.r2.dev https://*.videodelivery.net https://*.cloudflarestream.com",
    "frame-src 'self' https://*.videodelivery.net https://*.cloudflarestream.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests"
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", buildCsp(nonce));

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("content-security-policy", buildCsp(nonce));
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(self)");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const production = process.env.NEXT_PUBLIC_APP_MODE === "production" && url && key;
  const studentExperienceV2 = process.env.NEXT_PUBLIC_STUDENT_EXPERIENCE_V2 !== "false";
  if (!production) return response;

  const supabase = createServerClient(url!, key!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items: { name: string; value: string; options: CookieOptions }[]) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    }
  });
  const pathname = request.nextUrl.pathname;
  const isPublic = pathname === "/" || publicPrefixes.some((prefix) => isPathUnder(pathname, prefix)) || pathname.startsWith("/_next") || pathname.includes(".");
  const isStudentOwnedContent = pathname.startsWith("/editor/") || pathname.startsWith("/remix/");
  const isAdminOnlyRoute = adminOnlyPrefixes.some((prefix) => isPathUnder(pathname, prefix));
  const isAuthEntryRoute = pathname === "/login" || pathname === "/signup";
  const mayRedirectStudent = studentExperienceV2 && !isPublic && !isStudentOwnedContent && !pathname.startsWith("/student") && !pathname.startsWith("/api/");

  // The organization_members lookup is a second sequential network round trip to Supabase on top
  // of getUser(), and only three rules below actually read memberRole. Every /student/* request —
  // i.e. every tab click in the student experience — used to pay for it and then never use it,
  // because the student-redirect rule explicitly excludes paths already under /student. Querying
  // only when a rule can act on the answer removes that round trip from the hot path; the three
  // rules keep their original conditions, each of which implies needsRole.
  const needsRole = mayRedirectStudent || isAdminOnlyRoute || isAuthEntryRoute;

  const { data: { user } } = await supabase.auth.getUser();
  let memberRole: string | null = null;
  if (user && needsRole) {
    const { data: membership } = await supabase.from("organization_members").select("role").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: true }).limit(1).maybeSingle();
    memberRole = membership?.role ?? null;
  }
  if (!user && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(login);
    redirect.headers.set("content-security-policy", buildCsp(nonce));
    return redirect;
  }
  if (user && memberRole === "student" && mayRedirectStudent) {
    const studentHome = request.nextUrl.clone();
    studentHome.pathname = "/student";
    studentHome.search = "";
    const redirect = NextResponse.redirect(studentHome);
    redirect.headers.set("content-security-policy", buildCsp(nonce));
    return redirect;
  }
  if (user && isAdminOnlyRoute && memberRole !== "admin" && memberRole !== "owner") {
    const unauthorized = request.nextUrl.clone();
    unauthorized.pathname = "/unauthorized";
    unauthorized.search = "";
    unauthorized.searchParams.set("reason", "unauthorized");
    unauthorized.searchParams.set("from", pathname);
    const redirect = NextResponse.redirect(unauthorized);
    redirect.headers.set("content-security-policy", buildCsp(nonce));
    return redirect;
  }
  if (user && isAuthEntryRoute) {
    const landing = request.nextUrl.clone();
    landing.pathname = memberRole === "student" ? (studentExperienceV2 ? "/student" : "/learn") : "/dashboard";
    landing.search = "";
    const redirect = NextResponse.redirect(landing);
    redirect.headers.set("content-security-policy", buildCsp(nonce));
    return redirect;
  }
  return response;
}

// Static assets served from /public (fonts, icons, images, manifests) previously still ran the
// full middleware — two sequential Supabase round trips each — only to be classified as public by
// the pathname.includes(".") test and returned unchanged. Excluding them at the matcher is not a
// new security hole: every path with a dot was already treated as public by that same test, so
// this set is a strict subset of what already bypassed the auth redirects. Extension-less routes
// (all real pages, including RSC navigations) are unaffected and still fully protected.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|woff|woff2|ttf|otf|txt|xml|webmanifest)$).*)"] };
