# H2OBOOK Operations Expansion Foundation — Integration Report

- Branch: `feature/h2obook-operations-foundation`
- Backup tag: `h2obook-before-operations-foundation` (on `main`, pre-integration)
- Base: `main` @ `2b7a3e8` (H2OBOOK 4.15 — Knowledge Universe hero)
- Module source: `H2OBOOK-OPERATIONS-EXPANSION-FOUNDATION-MODULE`
- Package version bumped: `4.15.0` → `4.17.0`

## Scope

Adds four missing operational spaces plus public certificate verification, as route
structure, role contracts, demo stores and feature flags — not a redesign of Public
Academy, Student Experience, Business Workspace, Editor, Input, Publishing, Supabase,
R2, Redis or worker architecture:

- Customer / Admissions Portal — `/customer`, `/customer/onboarding`, `/customer/orders`, `/customer/payments`
- Instructor Workspace — `/instructor`, `/instructor/classes`, `/instructor/assessments`, `/instructor/students`
- Operations Center — `/operations` and 8 sub-areas (admissions, support, approvals, notifications, import-center, automation-center, product-config, system-health)
- Platform Super Admin foundation — `/platform-admin` and 3 sub-areas (disabled by default, unreachable until a real role exists — see Role mapping)
- Certificate Verification — `/verify/[certificateNo]` (public, read-only)

Per the module's own docs (`docs/operations-foundation/ROADMAP.md`,
`FUTURE-PAGE-UPGRADE-CONTRACT.md`), most Operations Center sub-routes render distinct
real content (`components/operations/center-page.tsx`, one `kind` per route), but the
Instructor and Platform Admin sub-routes (`/instructor/classes`, `/instructor/assessments`,
`/instructor/students`, and the three `/platform-admin/*` children) currently all render
the same dashboard component as their parent, differentiated only by active-nav
highlighting — this is the module's own stated foundation scope, not a defect
introduced here.

## Files added/merged

**Copied from the module, unmodified in content** (only relocated per repo layout):
`types/operations.ts`, `lib/operations/{data,feature,permissions,routes}.ts`,
`store/operations-store.ts`, `components/operations/*.tsx` (except the fix below),
`components/operations/operations.module.css`, `scripts/validate-operations-foundation.mjs`,
`tests/unit/operations-foundation.test.ts`, all 22 route pages under
`app/{customer,instructor,operations,platform-admin,verify}/**`.

**Fixed during integration** (pre-existing bug in the module, not introduced here):
`lib/operations/routes.ts` and `components/operations/center-page.tsx` imported
`PackageCog` from `lucide-react`, which does not exist in this repo's installed
`lucide-react` version (`tsc` error `TS2724`). Replaced with `PackageSearch` (orders icon)
and `Settings2` (product-config icon, already imported in that file).

**New, written for this integration** (not shipped by the module — role/auth wiring was
explicitly left to the integrator per `docs/operations-foundation/INTEGRATION-GUIDE.md`):
- `lib/operations/role-bridge.ts` — maps the repository's real `CurrentUser.role`
  (`owner|admin|designer|partner|teacher|student`) onto the module's `OperationsRole`
  superset; `designer`/`partner` bridge to `null` (no Operations Foundation area yet).
- `app/customer/layout.tsx`, `app/instructor/layout.tsx`, `app/operations/layout.tsx`,
  `app/platform-admin/layout.tsx` — server-side guards using `requireCurrentUser()` +
  `canAccessOperationsArea()`, redirecting to `/dashboard` when the flag is off or the
  role doesn't match, following the same pattern as `app/student/layout.tsx`.
- `tests/e2e/operations-foundation.spec.ts` — targeted Playwright coverage (see Tests run).
- `supabase/migrations/0025_h2obook_operations_foundation.sql` — revised migration (see below).

**Modified, minimally, non-destructively:**
- `middleware.ts` — added `/verify` to `publicPrefixes` (only this one addition; the
  academy-loop CSP/route changes visible in a sibling branch are not part of this diff).
- `components/layout/sidebar.tsx` — one Operations Center entry added to the `system`
  domain's link list, gated on `operationsFeatures.operationsCenter`; nothing removed
  or reordered.
- `.env.example` — appended the module's 5 flags, unchanged from its own `.env.operations.example`.
- `package.json` — added `validate:operations-foundation` script; version bump.
- `next.config.ts` — brought forward the existing win32/Vercel `output:"standalone"` guard
  and `@valkey/valkey-glide` webpack alias that already exist on the (separate, unmerged)
  `feature/academy-revenue-loop-v416` branch. `main` itself was missing this fix, which
  made a from-scratch Windows build here fail with an unrelated `EPERM` symlink error
  before any of this module's code ever ran. Needed to verify `pnpm build` locally;
  unrelated to the module's own files.

Not overwritten, as instructed: `.git`, `.env.local` (does not exist here), `pnpm-lock.yaml`
(no new dependencies — the module only uses `lucide-react` and `zustand`, both already
repo dependencies), existing `AppShell`/`StudentShell`, existing stores, existing migrations,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/VALIDATION-REPORT.md` (name collisions with
the module's own docs of the same name — the module's copies live under
`docs/operations-foundation/` instead).

## Role mapping

| Repo role (`member_role` enum, `0001_h2obook_core.sql`) | Bridges to `OperationsRole` | Areas reachable |
|---|---|---|
| `owner` | `owner` | customer, instructor, operations, certificate_verify |
| `admin` | `admin` | customer, instructor, operations, certificate_verify |
| `teacher` | `teacher` | instructor, certificate_verify |
| `student` | `student` | customer (pre-provisioning only — real students are already routed to `/student` by the existing middleware rule), certificate_verify |
| `designer`, `partner` | `null` (denied) | none — no Operations Foundation area is defined for them yet |
| n/a — `admissions`, `support`, `finance`, `content_manager`, `platform_admin` | never produced by the bridge | unreachable by real accounts |

`types/operations.ts`'s `OperationsRole` is a superset of the repo's actual `member_role`
enum. Per the integration prompt ("admissions/support/finance/content_manager -> /operations
only if these roles exist in the current database contract" / "platform_admin -> /platform-admin
only after a real platform role is implemented"), those five roles are **not** added to the
database enum or the auth contract in this pass. Their permission rules exist in
`lib/operations/permissions.ts` for future use, but `role-bridge.ts` can never produce them
today, so:
- `/operations` is reachable only by `owner`/`admin` in practice right now.
- `/platform-admin` is unreachable by any real account (verified: `NEXT_PUBLIC_PLATFORM_ADMIN_V1=false`
  by default, and even if flipped true, the role check still fails for every current role — confirmed
  by the e2e test "platform admin is unreachable until a real platform_admin role exists").

## Route protection

- Auth gate: unchanged existing `middleware.ts` rule (`!user && !isPublic` → redirect to
  `/login`) already covers `/customer`, `/instructor`, `/operations`, `/platform-admin` since
  none of them were added to `publicPrefixes`.
- Student containment: the existing middleware rule that redirects `memberRole === "student"`
  away from any non-`/student` path already prevents provisioned students from reaching these
  areas; not modified.
- Role gate: each area's own `layout.tsx` (new, listed above) enforces
  `canAccessOperationsArea`, independent of and in addition to middleware.
- `/verify/[certificateNo]` — public (added to `publicPrefixes`), server component, no
  client store dependency. Reads `seedCertificates` and renders only
  `certificateNo/studentName/courseName/instructorName/issuedAt/status`; `verificationToken`
  is in the type but never rendered (`components/operations/certificate-verification.tsx`).
  Verified: `/verify/<unknown>` returns HTTP 200 with an explicit "not found" message, not
  an error page.

## Migration decision

Applied the "compare, then produce a revised migration" instruction from
`docs/operations-foundation/INTEGRATION-GUIDE.md` step 9 and the prompt's rule 10.
`optional/supabase/0023_h2obook_operations_expansion_optional.sql` was **not** copied as-is:

- It had no RLS policies at all (tables merely had RLS *enabled*, meaning nothing was
  readable/writable by anyone) — not usable without adaptation.
- It didn't reference the repo's `public.has_org_role`/`public.is_org_member` helpers.

`supabase/migrations/0025_h2obook_operations_foundation.sql` (new, not yet applied to any
database) keeps the same 6 tables/columns/checks, and adds:
- RLS policies scoped to `owner`/`admin` via `public.has_org_role`, matching the pattern in
  `0024_h2obook_v416_academy_revenue_loop.sql` (on the sibling branch) — not the
  `admissions/support/finance/content_manager` roles, since those aren't real yet.
- Self-read policies for `customer_applications`/`support_tickets` by `customer_user_id`/`requester_user_id`.
- Reuses the existing `public.touch_updated_at()` trigger function
  (`0007_h2obook_v41_production_foundation.sql`) instead of redefining it.
- A comment on `certificate_issues` stating explicitly that no public SELECT policy is
  granted — `/verify` must read through a narrow server-side path, never a client-side
  Supabase query, to avoid leaking `verification_token`/`organization_id`.
- Foreign keys to `public.assets`/`public.profiles` where the optional SQL had loose `uuid` columns.

**Migration-number collision, resolved:** this branch and the sibling
`feature/academy-revenue-loop-v416` branch (uncommitted work from an earlier session,
committed and pushed separately today) were both cut from the same `main` and each
originally added their own `0024_*.sql`. Since `feature/academy-revenue-loop-v416` merges
to `main` first, this branch's migration was renamed to
`0025_h2obook_operations_foundation.sql` before merging, keeping the chain sequential.

## Validators / gates run

All commands below were run against `feature/h2obook-operations-foundation` (this branch), with a clean `.next` and no other H2OBOOK dev servers running.

| Command | Result |
|---|---|
| `node scripts/validate-operations-foundation.mjs` | Pass — 16 core files, 4 route spaces |
| `pnpm validate:migrations` | Pass — 24 sequential migrations, `0001` → `0025_h2obook_operations_foundation.sql` |
| `pnpm validate:imports` | Pass — 401 source files |
| `pnpm validate:ui414` | Pass — 24 required files, 9 architecture checks, 3167 CSS blocks |
| `pnpm typecheck` | Pass, 0 errors (after the `PackageCog` fix above) |
| `pnpm test` | Pass — 15 files, 50 tests (incl. the module's own `operations-foundation.test.ts`, 4 tests) |
| `pnpm build` | Pass — 141 routes generated, including all 22 new routes, all correctly marked `ƒ` (dynamic, server-rendered) since they resolve `requireCurrentUser()` per request |
| `pnpm test:e2e` (`tests/e2e/operations-foundation.spec.ts`, new) | Pass — 7 assertions × 2 projects (chromium, mobile) = 14/14 |
| `pnpm test:e2e` (`ui-414.spec.ts`, `knowledge-universe.spec.ts`, `smoke.spec.ts` — regression check) | Pass — 6/6, no regression from the `sidebar.tsx`/`middleware.ts` edits |
| `pnpm lint` | **Not run** — `main` has no `eslint.config.js` (ESLint 9 flat config) at all; this is a pre-existing repo-wide gap unrelated to this module (a fix exists only on the unmerged academy-loop branch). Not part of this integration prompt's required gate list; `typecheck` + the two Playwright passes above stand in as the static/functional checks. |

New e2e spec covers: customer portal renders for the demo owner; instructor workspace
renders; operations center renders the admissions pipeline; `/platform-admin` redirects
to `/dashboard` (role unreachable, by design); `/verify/<known>` shows the valid badge
without leaking `verificationToken`; `/verify/<unknown>` returns 200 with an explicit
invalid message; the workspace sidebar surfaces the new Operations Center link under
the System domain (confirmed only visible in that domain's context, not globally, since
the sidebar's link list is scoped per active domain — pre-existing behavior, not new).

## Preview URL

None. Per the prompt: push only the feature branch, do not merge `main`, do not deploy
production. No Vercel preview was triggered from this session.

## Rollback

- `git checkout feature/h2obook-operations-foundation -- .` was never applied to `main`;
  rollback is simply not merging the branch, or `git tag -d`/branch delete if the branch
  itself needs discarding.
- If merged and a rollback is needed later: `git revert` the merge commit, or flip
  `NEXT_PUBLIC_CUSTOMER_PORTAL_V1` / `NEXT_PUBLIC_INSTRUCTOR_WORKSPACE_V1` /
  `NEXT_PUBLIC_OPERATIONS_CENTER_V1` / `NEXT_PUBLIC_CERTIFICATE_VERIFY_V1` to `false` — every
  area's `layout.tsx` redirects to `/dashboard` when its flag is off, so this fully hides
  the surface without a code rollback. `NEXT_PUBLIC_PLATFORM_ADMIN_V1` already defaults `false`.
- Migration `0025_h2obook_operations_foundation.sql` was never run against any database in
  this session (no Supabase project configured — demo mode only); nothing to roll back there.
- Backup tag `h2obook-before-operations-foundation` marks `main` exactly as it was before
  this branch was cut.

## Final status

**READY_FOR_VERCEL_PREVIEW**

All required gates pass on a clean build/typecheck/test/e2e run. Two known, intentional
limitations carried forward from the module's own foundation scope (not blockers):
`admissions/support/finance/content_manager/platform_admin` have no real accounts yet, and
several Instructor/Platform-Admin sub-routes are placeholder duplicates of their parent
page pending future page-by-page upgrades (tracked in `docs/operations-foundation/ROADMAP.md`
and `FUTURE-PAGE-UPGRADE-CONTRACT.md`). The migration-number collision with the sibling
academy-loop branch must be resolved by whichever branch merges second.
