# H2OBOOK System Control Plane & Operations Intelligence V2 — Integration Report

Branch: `feature/system-control-plane-operations-intelligence-v2`
Source module: `v5/14-h2obook-system-control-plane-operations-intelligence-v2`
Status: **READY_FOR_VERCEL_PREVIEW**

Same standing instruction as prior passes: audit before coding. This module's own prompt is
explicit that it must not be declared complete without real infrastructure verification —
this report follows that rule and states plainly what is real vs. deferred.

## 1. Audit summary + consistency findings (Phase 1)

- **This repo already has a real, live canonical health source**: `lib/runtime-config.ts`'s `getRuntimeCapabilities()` — used by the existing `/api/readiness` endpoint — already reports real `configured`/`required` state per service from actual env vars (Supabase, R2, Redis, file scanner, payment, email, AI Gateway, monitoring). This is exactly Phase 3's "canonical health source" requirement, just not yet exposed as a scored, alert-generating System Command Center. This module adapts that existing source (`lib/system/live-health.ts`) rather than introducing a second, parallel service registry with its own drifting set of service ids (the reference module's `SERVICE_REGISTRY` was **not** ported for this reason).
- **`/store`, `/orders`, `/membership`, `/analytics`, `/marketplace-studio`, `/licensing`, `/white-label`, `/growth-reader`, `/operations/*` (all 9 Operations Center pages), and `/platform-admin/*` are ALL pure client-side demo pages** (`useOperationsStore()` / `useAppStore()` Zustand stores with hardcoded seed data) — including `/operations/system-health` and `/platform-admin/system-health`, which literally render a fixed list of services all marked `"active"`/`"Sẵn sàng"` regardless of reality. This is precisely the "static healthy state" this module's prompt forbids, and it is a **much larger pre-existing gap** than this one module can close — migrating all 9 Operations Center screens and 4 Platform Admin screens off demo data is its own multi-module effort (Operations already has real backing tables from migration 0025 — `admission_leads`, `customer_applications`, `support_tickets`, `approval_requests`, `operations_import_jobs`, `certificate_issues` — the data model exists, the UI does not read it yet). Per the same "leave what you audited but can't safely finish this pass" precedent as module 13 (Admin Business Operations), **none of these existing pages were touched**.
- **The source module's `WorkspaceRole` includes mentor/instructor/reviewer/admissions/support_agent/operations_manager/system_admin** — none of those exist as real `public.member_role` values (same reconciliation already applied in modules 12 and 13). `WorkspaceRole` here is narrowed to the repo's real roles; System Control Plane access maps onto the two real privileged roles, `admin` and `owner`.
- **No MFA or "recent reauthentication" mechanism exists anywhere in this codebase** (grepped for `mfa`/`reauthenticat*` repo-wide — zero hits outside the reference module itself). Phase 5 ("Dangerous Actions") explicitly requires capability check + workspace scope + recent reauthentication + MFA + typed confirmation + reason + audit event + request ID before any backup restore / reset data / rotate secret / transfer ownership / delete workspace / payment override / manual entitlement / privileged role change. **None of those 8 dangerous actions exist as real features in this app yet either** — there is nothing to gate. Shipping a "guard" function with no real caller and no real MFA check behind it would be dead code that falsely implies a security control exists; Phase 5 is fully deferred (§5) rather than half-built.
- **Confirmed the entire legacy Admin workspace (`/dashboard`, `/books`, and everything in `components/layout/sidebar.tsx`) currently has zero role-based access control** — `middleware.ts` only redirects `role === "student"` sessions away from non-`/student` paths; teacher/designer/partner accounts can currently reach every Admin page including `/security`, `/admin`, etc. This is a real, significant, pre-existing gap discovered during this audit. Restructuring access control across ~40 existing routes is far outside this module's safe blast radius (the prompt's own rule 2 forbids deleting/replacing existing routes, and retrofitting role gates onto routes that different real roles may legitimately already rely on — e.g. a teacher using `/books`/`/students` — risks breaking real workflows without a dedicated audit of each route). This module adds real, enforced access control **only to the one new route it creates** (`/system`); the broader gap is documented here, not silently left implying it was fixed.
- **`public.domain_events`/`capture_domain_event()` (migration 0007) already is the repo's audit engine** for table-level changes (insert/update/delete row snapshots) — reused conceptually rather than duplicated; since no dangerous action exists yet to log, no new audit call site was added in this pass.
- Confirmed the existing Admin sidebar (`components/layout/sidebar.tsx`) already has a "System" domain group; the new `/system` link was added there behind a feature flag, following the exact same conditional-render pattern already used for `/operations` (`operationsFeatures.operationsCenter`).

## 2. Files added/changed

**Database**: none. Every value this pass needed already exists as real, live data (`getRuntimeCapabilities()`) or is computed on the fly — no migration was needed or added. This differs from every prior module in this session; it is a deliberate, justified zero-migration pass rather than an oversight (see §1's SERVICE_REGISTRY note and the `h2o_service_checks`/`h2o_system_alerts`/`h2o_system_incidents`/`h2o_audit_events`/`h2o_operations_priority_items`/`h2o_feature_flags` reference tables in `supabase/20260803_system_control_plane_operations_intelligence_v2.sql`, none of which were needed for the real, scoped-down slice actually shipped).

**Server logic (`lib/system/*`, all new)**
- `types.ts` — narrowed `WorkspaceRole`, plus `ServiceHealthCheck`/`SystemAlert`/`HealthScoreResult`/capability types adapted from `src/core/types.ts`.
- `permissions.ts` — `hasCapability`/`canAccessSystem`, trimmed to the two real privileged roles.
- `health.ts` — `calculateHealthScore()`, the scoring algorithm (config/connection/operational penalties) ported faithfully from `src/core/health.ts`, adapted to score `ServiceHealthCheck[]` built from real data instead of a parallel registry.
- `live-health.ts` — `getLiveServiceChecks()`: builds real `ServiceHealthCheck[]` from `getRuntimeCapabilities()` for configuration state, plus **one genuinely live check** (a real Supabase query via the service-role client) for the single most consequential dependency. Every other configured-but-unverified service honestly reports `connection: "not_tested"` / `operational: "unknown"` rather than a fabricated "healthy" — the literal fix for this module's #1 rule ("Production pages must never display demo counters or static healthy states").
- `request.ts` — `resolveSystemAccess()` (API routes) / `resolveSystemAccessForPage()`, mirroring `lib/teaching/request.ts` and `lib/business/request.ts`.

**API routes**
- `app/api/system/health/route.ts` (new) — admin/owner only, returns the real, live health score.

**UI**
- `app/system/page.tsx` (new) — async Server Component; re-resolves role server-side and redirects any non-admin/owner session to `/dashboard` before any system data is touched (defense in depth on top of the API route's own check).
- `app/system/system-command-center-client.tsx` (new) — System Command Center: real Health Score, environment, per-service configuration/connection/operational badges (required services scored, optional/conditional services shown separately, un-tested services honestly labeled), alerts derived from real missing/failed services.
- `lib/operations/routes.ts` — added `systemRoutes` (Command Center + quick links to the existing `/security`/`/integrations` pages, preserving those deep links per Phase 8).
- `lib/operations/feature.ts` — added `systemControlPlane` flag (`NEXT_PUBLIC_SYSTEM_CONTROL_PLANE_V2`, default enabled), the one feature flag from Phase 2 that gates something this pass actually built. `operations_intelligence_v2` and `grouped_system_navigation_v2` were not added since neither Operations Intelligence nor the 6-group System navigation were built this pass (§5) — adding unused flags for unbuilt features was judged as speculative, not real.
- `components/layout/sidebar.tsx` — one new conditional link to `/system` in the existing "System" domain group, same pattern as the existing `/operations` link.

## 3. Security implementation

- `/system` (the page) re-resolves the caller's real organization role server-side via `resolveOrganizationAccess()` and redirects non-admin/owner sessions to `/dashboard` before rendering anything — role is never read from client state.
- `/api/system/health` independently re-checks the same thing via `resolveSystemAccess()` — a direct API call bypassing the page still gets a real 403, not just a hidden UI element.
- No secret, service-role key, or provider credential is ever sent to the client: `getLiveServiceChecks()` and the Supabase live-ping run entirely in `lib/system/live-health.ts`, marked `import "server-only"`, and only the resulting `ServiceHealthCheck[]` (booleans/enums/labels — no credentials) crosses the API boundary.

## 4. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 50 pre-existing warnings unrelated to this module |
| `pnpm test` (vitest) | ✅ 21 files / 69 tests passed, no regressions |
| `pnpm test:sql` | ✅ passed (no new tables to check) |
| `pnpm validate:migrations` | ✅ 30 sequential migrations (unchanged — no new migration) |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; `/system` and `/api/system/health` present in the route manifest |

Not executed: live multi-role click-through (Student/Member/Admin/Owner), Playwright E2E — no browser in this session. Given no dangerous action exists yet, the module's own test items #11 (MFA/reauth/typed-confirmation) and #15 (Approval/Automation reuse) are not applicable to what was actually built.

## 5. Risks / TODO (explicitly deferred, not silently dropped)

- **Operations Intelligence (Phase 2's 8-section Operations shell, Phase 7's priority queue, the `operations_intelligence_v2` flag) was not built.** The 9 existing `/operations/*` pages remain demo/Zustand-backed, exactly as found. This is the single largest deferred item — real backing tables already exist (0025) but wiring 9 screens to them is its own module-sized effort.
- **Grouped System navigation (Phase 2's 6 groups: Tổng quan hệ thống / Truy cập & bảo mật / Hạ tầng & tích hợp / Dữ liệu & khôi phục / Smart Core & AI / Cấu hình workspace) was not built.** `/system` ships as one focused, honest Health Score page (matching Phase 7's explicit "System Command Center must show" list) rather than 6 groups where 5 would have to be empty placeholders — judged as more honest than building tabs with nothing real behind them yet.
- **Integration Control Center, Security & Trust Center, Data Continuity Center, Smart Core & AI Governance UIs (the other 4 supplied TSX components) were not adapted.** No real backing data source was identified for most of them in this pass (e.g. Data & Recovery has no backup/restore system to report on).
- **Dangerous Actions (Phase 5) fully deferred** — no MFA, no reauthentication-freshness check, and none of the 8 dangerous actions exist as real features yet (see §1). Building the guard now would be unused scaffolding implying a security control that isn't actually enforced anywhere.
- **The broader, pre-existing lack of role gating across the entire legacy Admin workspace** (found during audit, §1) is unresolved — only the new `/system` route got real enforcement this pass.
- **Only Supabase gets a real live connectivity check.** R2, Redis/BullMQ, the document worker, the payment provider, the email provider, and the AI Gateway report configuration state only (`connection: "not_tested"`) — building real live pings for each is real future work, not fabricated in this pass.
- No Playwright E2E role matrix was run (no browser available in this session).

## 6. Rollback

- Revert the merge commit on `main`, or `git revert` this module's commit range.
- Database: no migration was added, so there is nothing to roll back at the database layer.
- The new `/system` route and its API route are additive and gated by `NEXT_PUBLIC_SYSTEM_CONTROL_PLANE_V2`; setting that env var to `false` hides the sidebar link without any code change (the route itself still enforces admin/owner server-side regardless).
