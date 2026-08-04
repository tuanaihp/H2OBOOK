# H2OBOOK — Phase 1: Auth & Routing — Integration Report

Branch: `feature/phase1-auth-routing-hardening`
Scope: exactly the confirmed P0/P1/P2 items from `docs/H2OBOOK_PRODUCTION_GAP_AUDIT.md` that fall
under "Auth và Routing" — §4.1, §4.2, §4.3, §4.5, §4.7. No other gap was touched. No new
route/table/module was created beyond what those findings' own "cách sửa tối thiểu" specified.

## 1. Confirmed gaps fixed

### §4.1 [P0] No role gate on the legacy Admin Workspace route tree
- Added `adminOnlyPrefixes` to `middleware.ts`: `/admin`, `/platform-admin`, `/security`,
  `/enterprise`, `/integrations`, `/cloud-sync`, `/settings`, `/smart-settings`,
  `/assist-control`, `/offline`. A non-`admin`/`owner` session hitting any of these is redirected
  to `/unauthorized?reason=unauthorized&from=<path>` instead of rendering the page.
- **Deliberately excluded from the gate** (per the audit's own instruction not to break existing
  navigation with a blanket deny): `/books`, `/editor/*`, `/remix/*` (confirmed real, multi-role
  content authoring), all Create-domain tools (`/assets`, `/templates`, `/design-library`,
  `/brand-kit`, `/clones`, `/bulk-publishing`, `/content-health`, `/publish`, `/ingestion`,
  `/blocks`), all Teach-domain tools (`/students`, `/class-view`, `/reviews`, `/collaboration`,
  `/automations`, `/processing`, `/assignments`, `/quizzes`, `/classes`, `/knowledge`, `/library`,
  `/preflight`, `/study`), Business-domain tools (`/store`, `/orders`, `/membership`,
  `/analytics`, `/marketplace-studio`, `/licensing`, `/white-label`, `/growth-reader`),
  `/operations/*` (Operations Manager is a documented-but-not-yet-real role concept — gating it
  now would block a role this app has no way to grant yet, with no upside since those pages are
  still demo data), `/customer/*` (a separate external-customer portal, not an admin surface),
  `/ai-studio` (a Create-domain writing-assist tool), `/dashboard` (general landing).
- This is a **narrower fix than "the whole legacy workspace"** — it closes the highest-risk,
  unambiguous System/Platform-Admin surfaces now; the Business/Teach/Create/Operations tool
  routes remain exactly as reachable as they were before this change, consistent with "không phá
  navigation hiện tại."

### §4.7 [P1] No Unauthorized/Access-Required/Membership-Expired page states
- New `app/unauthorized/page.tsx`: renders one of three states from a `?reason=` query param
  (`unauthorized`, `entitlement_required`, `membership_expired`), each with its own icon, message
  and a relevant call-to-action link. Added to `middleware.ts`'s `publicPrefixes` so it's always
  reachable without triggering another redirect.
- Only `reason=unauthorized` is actually triggered by code today (from §4.1's middleware branch).
  `entitlement_required`/`membership_expired` are built and ready but **not wired to any call
  site** — no existing code path currently needs them, and inventing one would be speculative
  scope beyond the confirmed gap. Documented here, not silently added as a claim of completion.
- "Coming Soon" state was not built: no code path in this repository currently needs to render a
  "planned, not yet built" route (every route either exists as real/demo content or returns a real
  404 via `app/not-found.tsx`, which was already confirmed working in the audit).

### §4.2 [P1] Auth callback silently proceeded without a session on expired/missing code
- `app/auth/callback/route.ts` now checks `exchangeCodeForSession()`'s `{ error }` result and the
  presence of `code` before proceeding; either failure now redirects to `/login?error=link_expired`
  instead of silently continuing to `next`/`/dashboard` with no session.
- Both login variants (`components/public-academy-v5/public-login-experience.tsx`, the active
  default; `components/marketing/legacy-login-form.tsx`, used only when
  `NEXT_PUBLIC_AUTH_EXPERIENCE_V2=false`) now check for `?error=link_expired` on mount and show a
  clear Vietnamese message explaining the link expired, instead of the user just looking logged
  out with no explanation.

### §4.3 [P1] Mobile login hero pushed the form below the fold
- `components/public-academy-v5/public-auth-v5.module.css`'s `@media(max-width:900px)` block
  (covers all three required test widths — 360×800, 390×844, 430×932) now sets `order:1` on
  `.loginPanel` and `order:2` on `.brandPanel` (CSS grid `order`, no DOM/JSX change), so the
  email/password form renders first. The hero's `min-height:44vh` was also replaced with
  `min-height:auto` plus a compact heading (`3.6rem`→`1.8rem`) and tighter padding, so even when
  the user scrolls to it below the form, it's a short brand strip, not a near-half-screen hero.
- The legacy login form's CSS (only active when V2 is explicitly disabled) was left unchanged —
  out of scope since the audit's evidence was specifically about the active default experience.

### §4.5 [P2] No per-entity metadata on detail pages; no noindex on auth pages
- Added `generateMetadata()` to `app/academy/books/[slug]/page.tsx`,
  `app/academy/courses/[slug]/page.tsx`, `app/academy/strategies/[slug]/page.tsx` — each now
  derives `title`/`description`/`openGraph` from the same catalog lookup the page body already
  uses (`findPublicBook`/`findPublicCourse`/`findPublicStrategy`), no new data fetch.
- Added `metadata = { robots: { index: false, follow: false } }` to `app/login/page.tsx`
  (already a Server Component) and `app/signup/page.tsx` (extracted its form into a new client
  component, `components/marketing/signup-form.tsx`, so the page itself could become a Server
  Component capable of exporting `metadata` — Next.js does not allow metadata exports from
  Client Components).
- Homepage (`app/page.tsx`) metadata was left as-is per the audit's own note that the generic
  root title is arguably correct brand copy for the homepage specifically — only the auth pages
  needed `noindex`, which they now have.

## 2. Files changed

**New**: `app/unauthorized/page.tsx`, `components/marketing/signup-form.tsx`.
**Modified**: `middleware.ts`, `app/auth/callback/route.ts`, `app/login/page.tsx`,
`app/signup/page.tsx`, `components/public-academy-v5/public-login-experience.tsx`,
`components/public-academy-v5/public-auth-v5.module.css`,
`components/marketing/legacy-login-form.tsx`, `app/academy/books/[slug]/page.tsx`,
`app/academy/courses/[slug]/page.tsx`, `app/academy/strategies/[slug]/page.tsx`.

No migration. No table touched. No existing route deleted or renamed.

## 3. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 51 pre-existing warnings, none new |
| `pnpm test` (vitest) | ✅ 22 files / 72 tests passed, no regressions |
| `pnpm test:sql` | ✅ passed |
| `pnpm validate:migrations` | ✅ 31 sequential migrations (unchanged) |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; `/unauthorized` present; all 9 static book/course/strategy detail pages still statically generated with real slugs; middleware bundle size increase (91.8→91.9 kB) reflects the new gate logic only |

Not executed: live browser test at the three phone widths, a real login→callback→redirect round
trip against a live Supabase project, or a live click-through of a blocked-role redirect. Per the
Phase 0 audit's own honesty rule, none of this is claimed as verified.

## 4. Risks / what remains unverified

- The `adminOnlyPrefixes` list in §1 is a judgment call about which of the ~40 legacy routes are
  unambiguously admin-only vs. plausibly multi-role. It was scoped conservatively (favoring "leave
  reachable" over "block and possibly break someone's workflow") — if the real intended role model
  turns out to be stricter than this, more prefixes can be added to the same list.
- `/operations/*` was deliberately left ungated — those pages are still demo data today, so the
  practical risk is low, but this should be revisited the moment any Operations page starts
  reading real Supabase data (already flagged as a large, separate deferred item in the Phase 0
  audit's own Production Upgrade Plan).
- `entitlement_required`/`membership_expired` states on `/unauthorized` are unused scaffolding
  until a real content-gating call site needs them — not a regression, just noted so it isn't
  mistaken for "entitlement gating was added" (it wasn't; only the page state exists).

## 5. Rollback

- Revert the merge commit, or `git revert` this branch's commit range.
- No migration to roll back. `git revert` alone is sufficient — no manual Supabase/R2 steps needed.
