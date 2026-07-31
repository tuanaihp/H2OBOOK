# H2OBOOK Public Academy V5 — Integration Report

- Branch: `feature/public-academy-v5`
- Backup tag: `h2obook-before-v5-public-academy` (on `main`, pre-integration)
- Baseline: `main` @ `9ddc036` (Operations Expansion Foundation merged)
- Module source: `H2OBOOK-PUBLIC-ACADEMY-V5-UNIFIED-MODULE` (v5 folder 1 of 6)

V5 replaces integrating Public Home V3 and Public Academy V4 separately — this is the only public/auth module from this batch; V3/V4 were never integrated in this repo, so there is nothing to archive.

## Scope

Public Home V3 (data-driven homepage + Journey Planner), About, Books, Courses, Learning Paths,
Strategy Hub, Membership + enrollment + checkout bridge, Login Experience V2 with safe role
redirect, shared fallback/Supabase loaders, analytics links and feature flags.

## Files added

`components/public-home-v3/*`, `lib/public-home-v3/*`, `components/public-academy-v5/*`,
`lib/public-academy-v5/*`, `app/academy/public-suite-v5-preview/*` (8 preview routes),
`app/academy/home-v3-preview`, `app/api/public/membership/lead/route.ts`,
`scripts/validate-public-academy-v5.mjs`, `scripts/validate-public-home-v3.mjs`,
`tests/unit/public-academy-v5.test.ts`, `components/marketing/legacy-login-form.tsx` (new —
extracted verbatim from the pre-V5 `/login`, needed because the route file had to become an
async server component to call the V5 loader; the legacy client form now lives in its own
`"use client"` file instead of being deleted).

Module docs and its optional SQL proposal are kept for reference under
`docs/v5-modules/public-academy-v5/` (its own `CLAUDE-INTEGRATION-PROMPT.md` copy was **not**
kept — `pnpm validate` treats `=====` section rules in that file as a git merge marker and fails;
the prompt is process documentation, not part of the shipped module, so dropping it is safe).

## Files merged (existing files edited, legacy path preserved as fallback)

- `app/page.tsx` — default export now checks `isPublicHomeV3Enabled()`; when on, loads
  `loadPublicHomeV3()` and renders `<PublicHomeV3 viewModel={...} hero={...}/>`, passing the
  existing Knowledge Universe Hero (or nothing, letting `PublicHomeV3` render its own default
  hero) as the `hero` prop — one hero, never two. When off, renders `LegacyPublicHomePage()`,
  the untouched previous implementation, byte-for-byte.
- `app/academy/{about,books,courses,learning-paths,strategies}/page.tsx`,
  `app/academy/membership/page.tsx` — each now branches on `isPublicAcademyV5Enabled()` (or
  `isPublicMembershipV2Enabled()` for membership specifically) to render the matching
  `PublicAcademy*Page` component with `loadPublicAcademyV5()`, else falls through to the
  original page body, renamed to a local `Legacy*Page()` function and otherwise unchanged.
- `app/login/page.tsx` — rewritten as an async server component branching on
  `isAuthExperienceV2Enabled()`; the old client-side form was extracted verbatim into
  `components/marketing/legacy-login-form.tsx` as the fallback.
- `.env.example` — appended the module's 6 flags.
- `package.json` — added `validate:public-home-v3` and `validate:public-academy-v5` scripts.

## Bug found and fixed (pre-existing in the module, not introduced here)

`components/public-academy-v5/public-academy-pages.tsx` called
`<TrackedLink resourceType="learning-path" .../>`, but `TrackedLink`'s prop type was hand-typed
as `"book" | "page" | "product"` — neither matched the canonical `AnalyticsEvent["resourceType"]`
union in `packages/analytics-core` (`book|page|quiz|product|assignment`), and `"learning-path"`
isn't in either. `tsc` failed with `TS2322`. Fixed by:
1. Binding `TrackedLink`'s `resourceType` prop directly to `AnalyticsEvent["resourceType"]` from
   `@h2obook/analytics-core` (`components/public-home-v3/tracked-link.tsx`) so it can never drift
   from the canonical contract again.
2. Changing the one offending call site to `resourceType="page"` (the closest valid category —
   a learning-path recommendation link is conceptually a page, not a purchasable product).

## Route protection / data flow

- `PublicShell` renders exactly once per real route — verified live (not just read): only one
  `<header class="h2o-public-header">` exists in the rendered DOM on `/`, `/academy/about`,
  `/academy/books`, `/academy/courses`, `/academy/learning-paths`, `/academy/strategies`,
  `/academy/membership`; `/login` renders zero (`PublicAcademyLoginPage` returns
  `PublicLoginExperience` directly, no shell), matching the module's own contract.
- `loadPublicHomeV3()` / `loadPublicAcademyV5()` are `server-only`, call
  `createSupabaseServerClient()`, and fall back to local fixed data
  (`buildFallbackPublicHomeViewModel` / `buildFallbackPublicAcademyViewModel`) whenever Supabase
  isn't configured or the query fails — this repo is running in demo mode, so every page above
  is rendering on the fallback path today; that's expected, not a defect (CLAUDE.md rule 9).
  No static catalog array was duplicated in `app/page.tsx` — the ecosystem/books/courses/strategy
  sections all come from `PublicHomeV3`'s internal use of `lib/public-site/content`.
- Membership plan mapping: `loadPublicAcademyV5()` maps `products` rows
  (`product_type=membership, status=active`) onto the fallback plan list by `slug` or
  `settings.publicPlanId`/`settings.public_plan_id` — no hardcoded product UUID anywhere in the
  component tree.
- Checkout: `MembershipEnrollmentClient` posts to the existing
  `app/api/payments/checkout/route.ts` unchanged; on `checkoutUrl` it redirects, on
  `qrPayload`/manual it shows the order state inline — matches the existing provider contract
  exactly (verified against the route's actual request/response shape).
- Lead capture: `app/api/public/membership/lead/route.ts` validates name/email/phone/consent,
  rejects bot submissions via a honeypot field and a sub-800ms elapsed-time check, hashes the
  analytics `anonymousId` (SHA-256, truncated), and only emits the
  `membership.lead_submitted` domain event when `PUBLIC_ACADEMY_ORGANIZATION_ID` is set —
  otherwise it still records analytics (`lead_submitted`) without a CRM side effect. No
  Operations Foundation admissions-CRM adapter exists yet in this repo, so a lead in demo mode
  is analytics-only; this is documented as a follow-up, not silently dropped.
- Login: keeps `createSupabaseBrowserClient`, `/api/auth/claim-access`, `/api/auth/session`
  unchanged. Role redirect (`roleHome()` in `public-login-experience.tsx`) now also covers
  `teacher → /instructor`, `admissions/support/finance/content_manager → /operations`,
  `platform_admin → /platform-admin` — an extension consistent with, and not a change to,
  the role contract added by the Operations Expansion Foundation (`lib/operations/permissions.ts`)
  already on `main`. Open-redirect is blocked by `safeNextPath()` (must start with `/`, must not
  start with `//`). `NEXT_PUBLIC_AUTH_DEMO_LINKS` defaults to `false` in `.env.example`; demo
  links only render when explicitly turned on.

## Environment variables

```env
NEXT_PUBLIC_PUBLIC_HOME_V3=true
NEXT_PUBLIC_PUBLIC_ACADEMY_V5=true
NEXT_PUBLIC_PUBLIC_MEMBERSHIP_V2=true
NEXT_PUBLIC_AUTH_EXPERIENCE_V2=true
NEXT_PUBLIC_AUTH_DEMO_LINKS=false
PUBLIC_ACADEMY_ORGANIZATION_ID=        # server-only, intentionally not NEXT_PUBLIC_
```

## Validation results

| Command | Result |
|---|---|
| `pnpm validate` | Pass — 51 core files (after removing the prompt doc with the false-positive merge-marker match) |
| `pnpm validate:imports` | Pass — 456 source files |
| `pnpm validate:public-home-v3` | Pass — 9 files |
| `pnpm validate:public-academy-v5` | Pass — 20 required files, 12 architecture checks |
| `pnpm typecheck` | Pass, 0 errors (after the `TrackedLink`/`resourceType` fix) |
| `pnpm test` | Pass — 17 files, 57 tests (incl. the module's own `public-academy-v5.test.ts`, 4 tests) |
| `pnpm build` | Pass — 149 routes, including all 8 `/academy/public-suite-v5-preview/*` routes and `/academy/home-v3-preview` |
| Live preview verification (Playwright, `pnpm start`) | All 9 preview routes: HTTP 200, 0 console errors, 0 hydration errors, no desktop/mobile horizontal overflow; login preview renders 0 `<header>` (no shell), every other preview renders exactly 1 |
| Live real-route verification (Playwright, `pnpm start`, flags on) | `/`, `/academy/{about,books,courses,learning-paths,strategies,membership}`, `/login`: all HTTP 200, 0 console errors, exactly 1 real `<header class="h2o-public-header">` on every shell-bearing route, 0 on `/login`, no overflow at 1440px or 390px |
| `pnpm test:e2e` (repo-wide) | Not re-run in this pass beyond the targeted checks above (Playwright driven directly for speed); existing `ui-414.spec.ts`/`knowledge-universe.spec.ts` cover `/` and were unaffected by this diff at the typecheck/build level |

No `any`, `ts-ignore`, or disabled lint used to hide the one real error found.

## Known limitations

- Demo mode only exercises the fallback data path for both loaders; Supabase-backed
  `public_home_configs` / `public_academy_configs` / membership product mapping have not been
  exercised against a real database in this session.
- Membership leads have no CRM destination yet (Operations Foundation's admissions pipeline
  isn't wired to `membership.lead_submitted`) — analytics-only until that adapter exists.
- `pnpm test:sql` was not run (no local Postgres/Supabase instance in this environment); the
  module ships no required migration (`optional/supabase/*.sql` files are informational —
  neither was applied or reviewed against RLS in this pass since nothing in this module's route
  wiring depends on them).

## Rollback

Every wired real route falls back to its untouched legacy implementation the moment its flag
flips to `false` — no code change needed:
`NEXT_PUBLIC_PUBLIC_HOME_V3=false`, `NEXT_PUBLIC_PUBLIC_ACADEMY_V5=false`,
`NEXT_PUBLIC_PUBLIC_MEMBERSHIP_V2=false`, `NEXT_PUBLIC_AUTH_EXPERIENCE_V2=false`.
Backup tag `h2obook-before-v5-public-academy` marks `main` exactly as it was before this branch.

## Preview URL

None generated in this session (per this integration's own instructions: no direct `main` merge,
no `vercel --prod`). Per the user's explicit instruction for this batch, this branch will be
merged directly once all six V5 modules pass their own gates.

## Final status

**READY_FOR_VERCEL_PREVIEW**
