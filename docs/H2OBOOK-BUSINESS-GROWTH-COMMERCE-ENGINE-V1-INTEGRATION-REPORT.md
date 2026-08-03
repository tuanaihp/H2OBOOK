# H2OBOOK Business Growth & Commerce Engine V1 — Integration Report

Branch: `feature/business-growth-commerce-v1`
Source module: `v5/13-h2obook-business-growth-commerce-engine-v1`
Status: **READY_FOR_VERCEL_PREVIEW**

Same standing instruction as prior passes: audit before coding, check consistency against the whole existing webapp, and do not touch Admin Business Operations before auditing (explicit in this module's own prompt).

## 1. Audit summary + consistency findings

- **`/store`, `/orders`, `/membership`, `/analytics`, `/marketplace-studio`, `/licensing`, `/white-label`, `/growth-reader` are all pre-existing, pure client-side demo pages** (`"use client"`, reading from the Zustand `useAppStore()`, not Supabase) — the original pre-Supabase-migration Admin editor UI. The prompt explicitly says not to touch these before auditing and not to overwrite Admin UI; per that instruction **none of these 8 routes were touched at all**, demo state and all — that gap is real but pre-existing and out of scope for this module.
- **Real, live commerce tables already exist and are already wired to production**: `public.products`/`orders`/`order_items` (0002) and `public.memberships`/`entitlements` (0001/0002), hardened by `public.mark_order_paid()` (0005) which is called from the real payment webhook (`app/api/payments/webhook/[provider]/route.ts`) — it already creates `entitlements` rows and, for `product_type='membership'`, `memberships` rows. This module reuses all of that directly; no parallel commerce tables were created.
- **The source module's `AccountRole` includes mentor/instructor/reviewer/training_manager** — same mismatch already reconciled in module 12 (`lib/teaching/types.ts`). `BusinessRole` here is narrowed to `student | admin | owner`; Business is a student-facing surface per the prompt's own design (mentor/instructor visibility into a student's business data is explicitly deferred, §7 of the prompt already treats it as gated/future).
- **No roadmap/career-stage table exists anywhere in the schema.** `lib/student/experience.ts`'s `studentCareerStages` (used by the Smart Home roadmap widget) is static demo data with the same hardcoded status for every user — not per-user, not real. Building a real per-user stage-unlock engine (Roadmap Builder) was out of scope for this pass; `unlockedStages` is resolved pragmatically instead: Stage 1 always, Stage 2 on the first real engagement signal (active membership, or a published/approved Create Outcome project), Stages 3-6 only via an explicit Admin `manual_grant` row in the new `business_feature_grants` table (`source_type='stage'`) — which the prompt itself explicitly allows ("Feature có thể mở sớm bằng... manual grant").
- **`public.entitlements`' `resource_id` is `uuid not null`** — it grants access to real content resources (books/templates/memberships), which does not fit a fixed text `BusinessFeature` slug vocabulary (`lead_tracker`, `pricing_builder`, …). Reusing it directly was not possible; the reference module's own `h2o_business_feature_grants` (text `feature_slug`) was the right shape, so it was ported (renamed to `business_feature_grants`, dropping the `h2o_` prefix — no other table in this repo uses it — and `organization_id` instead of `workspace_id`, matching this repo's convention).
- **No CRM/lead table fits a personal, per-learner sales pipeline**: `admission_leads` (0025) is for prospective students applying to the academy; `reader_leads`/`reader_campaigns` (0013, Growth Reader) are organization-owned marketing-funnel leads tied to a book campaign. Neither represents "a makeup student's own client pipeline." `business_opportunities` is genuinely new data, not a duplicate.
- **`h2o_business_tasks` was not ported.** The reference module's own `buildBusinessTasks(metrics)` is a pure function of already-real metrics — exactly the "derive, don't persist" pattern already established for the Today Task Planner (module 11) and the Teaching Command Center (module 12). No task-queue table was created.
- **`h2o_business_provenance_events` was not ported as a separate table.** The only real provenance target this pass has is `business_opportunities` (no Offer/Campaign entity was built — see §5), so provenance is two inline columns (`source_domain`, `source_payload`) on `business_opportunities` instead of a whole extra table.
- Confirmed `lib/student/compact-navigation.ts`'s BUSINESS group already existed (module 9) with 2 items pointing at `/academy/courses` and `/student/courses` — upgraded to the 4 items this module's IA calls for, still capped at 4, still with tools living inside each page as cards (not new sidebar entries), per the prompt's own UX constraint.
- Confirmed the existing `/student/*` namespace convention (courses, create, learn, assignments, library, mentor, profile, roadmap, spaces) — new routes were placed at `/student/business/*`, not a new top-level `/business/*`, adapting the prompt's suggested routes to this repo's existing architecture exactly as the prompt itself allows ("Nếu repository đã dùng namespace learner khác, điều chỉnh theo kiến trúc hiện tại nhưng giữ ý nghĩa").
- Confirmed `create_outcome_projects` (module 10) already has an `outcome_type` per project (`portfolio`, `brand_profile`, `pricing_kit`, `content_plan`, `sales_playbook`, plus `workbook`/`toolkit`/`casebook` which are learning artifacts, not commerce assets) — Growth Workspace maps the 5 commerce-relevant types onto the module's `CreateAssetReference.assetType` vocabulary instead of inventing a duplicate asset catalog.

## 2. Files added/changed

**Database** (`supabase/migrations/0030_h2obook_business_growth_commerce_v1.sql`)
- `public.business_goals`, `public.business_opportunities` (with inline Learn/Create/Teach provenance columns), `public.business_feature_grants` — 3 new tables (vs. the reference module's 5), each with RLS, `touch_updated_at` triggers, and (goals/opportunities) `capture_domain_event` triggers for a real change-history trail.
- Grepped every new identifier against migrations 0001–0029 before finalizing — no collisions.

**Server logic (`lib/business/*`, all new)**
- `types.ts` — narrowed `BusinessRole`, `BusinessAccessSnapshot`, and the rest of the domain types (ported from `src/core/types.ts`, admin_* feature variants dropped since Admin pages are untouched and not gated through this system).
- `access.ts` — `decideBusinessFeature`/`getAllowedBusinessFeatures`, pure, ported as-is from `src/core/access.ts`.
- `command-center.ts` — `calculateBusinessMetrics`/`calculateGoalProgress`/`buildBusinessTasks`/`buildBusinessCommandView`, pure, ported as-is from `src/core/command-center.ts`.
- `snapshot.ts` — `getBusinessAccessSnapshot()`, the real server-side resolution: active membership from `memberships`, best-effort `plan_name` → `CommercialPlan` mapping (`resolveCommercialPlan`), purchased/manual features and stage grants from `business_feature_grants`, `unlockedStages` per §1.
- `request.ts` — `resolveBusinessAccess()`, the shared entry point every `/api/business/*` route uses (mirrors `lib/teaching/request.ts`).
- `goals.ts`, `opportunities.ts` — owner-scoped CRUD over `business_goals`/`business_opportunities`.
- `assets.ts` — `getReadyCreateAssets()`/`countPublishedContent()`, reusing `create_outcome_projects` (module 10) directly.
- `operations.ts` — `getMyCommerceOverview()`, the caller's own `orders`/`memberships`/`entitlements` only (never another user's).
- `summary.ts` — `buildBusinessCommandCenterSummary()`, wires real opportunities/goals/published-content/ready-assets into `buildBusinessCommandView()`.

**API routes (`app/api/business/*`, all new)**
`command-center`, `opportunities` (GET/POST), `opportunities/[id]` (PATCH), `goals` (GET/POST), `assets`, `operations`.

**UI**
- `app/student/business/page.tsx` — Business Command Center: real headline/stage/progress, metrics, ranked tasks, unlocked features, ready Create assets, quick links to the other 3 tabs.
- `app/student/business/customers/page.tsx` — Customer & Sales Workspace: real add-lead form + status-pipeline list over `business_opportunities`.
- `app/student/business/growth/page.tsx` — Growth Workspace: real Create Outcome assets ready to use for marketing, plus honestly-locked cards (not fake numbers) for Content 90 Days / Growth Campaign / Growth Reader (§5).
- `app/student/business/operations/page.tsx` — Quyền lợi & vận hành: the caller's own real orders, membership status, and entitlements; link out to the public Knowledge Store.
- `lib/student/compact-navigation.ts` — BUSINESS group now has the 4 items this module's IA specifies, still unconditionally visible to any non-guest/non-admin/owner account (locked tools are cards inside the pages, not hidden sidebar entries).
- `components/student/student-shell.tsx` — icon map extended for the 4 new nav item ids.

## 3. Security implementation

- Every `/api/business/*` route calls `resolveBusinessAccess()` first: verifies the session, re-resolves real organization membership + role server-side (`resolveOrganizationAccess`), then builds `BusinessAccessSnapshot` — role/plan/stage/features are never read from the client.
- `business_goals`/`business_opportunities` RLS: `owner_id = auth.uid()` for all operations (plus org admin/owner read) — a student can never read or write another student's leads or goals, enforced at the database layer independent of the API layer.
- `business_feature_grants`: learners get SELECT only, scoped to their own active (non-revoked, non-expired) grants; INSERT/UPDATE/DELETE require `owner`/`admin` — a user cannot self-grant a feature, matching the prompt's explicit security test ("User không tự cấp feature").
- `orders`/`memberships`/`entitlements` reuse the pre-existing RLS from 0002/0005 (buyer/self-scoped + admin) — `lib/business/operations.ts` additionally filters every query to `access.userId` explicitly, so even the demo/admin-client code path never fetches another user's commerce data.
- Purchase-based feature grants persist independently of membership expiry: `decideBusinessFeature()` checks `manualFeatures`/`purchasedFeatures` before `activeMembership`, so a lapsed membership only removes membership-sourced features, never purchase-sourced ones — matching "Quyền mua lẻ vẫn còn khi Membership hết hạn."

## 4. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 50 pre-existing warnings unrelated to this module |
| `pnpm test` (vitest) | ✅ 21 files / 69 tests passed, no regressions |
| `pnpm test:sql` | ✅ passed |
| `pnpm validate:migrations` | ✅ 30 sequential migrations |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; all `/api/business/*` routes and `/student/business/*` pages present in the route manifest |

Not executed: live multi-role click-through (Guest/Basic/Membership Professional/Membership Marketing/Business Pro/Academy Pro/Admin), Playwright E2E role matrix — no browser in this session.

## 5. Risks / TODO (explicitly deferred, not silently dropped)

- **Admin Business Operations (`/store`, `/orders`, `/membership`, `/analytics`, `/marketplace-studio`, `/licensing`, `/white-label`, `/growth-reader`) remain 100% demo/client-store-backed.** This module deliberately did not touch them per its own instructions; migrating them to real Supabase data is a separate, larger, pre-existing gap.
- **No real per-user Roadmap/stage-unlock engine.** Stages 3-6 require an explicit Admin `manual_grant`; there is no Roadmap Builder UI yet for an admin to configure stage-to-feature mapping as the prompt's §6 describes.
- **Offer Builder and Pricing Builder are not separate dedicated tools.** Pricing is covered by Create Outcome Studio's existing `pricing-kit` recipe (module 10), linked from Growth Workspace — a second, parallel "Offer Builder" UI was judged as duplicating that rather than adding real value in this pass.
- **Sales Script Vault and Content 90 Days are not separate dedicated tools either** — same reasoning: Create Outcome Studio already has `wedding-sales-script-vault` and `90-day-content-plan` recipes; Growth Workspace links to them instead of building a second editor.
- **Growth Campaign builder and a per-learner Growth Reader view do not exist.** Growth Reader (module 5, 0013) is an organization-level marketing tool with no per-student ownership model; shown as an honestly-locked card in Growth Workspace rather than fabricated data.
- **Stage 6 tools (Customer Care, Revenue Dashboard, Service/Profit Calculator, Makeup CRM as a dedicated tool beyond the pipeline list, Business Automation) have no dedicated UI.** `decideBusinessFeature()` already knows how to gate them (for when they're built), but no screen renders them yet.
- **Marketplace listing / Licensing portal for learners (Academy Pro/White-label plan) have no learner-facing UI.** The existing `/marketplace-studio` and `/licensing` are Admin-only demo pages, untouched.
- **Mentor/Instructor visibility into a student's Business Goal/Offer/Campaign (module 12 integration, §7 of the prompt) was not built.** `TeachingAccessSnapshot` (module 12) and `BusinessAccessSnapshot` (this module) are not yet cross-wired.
- No Playwright E2E role matrix was run in this session (no browser available).

## 6. Rollback

- Revert the merge commit on `main`, or `git revert` this module's commit range.
- Database: migration 0030 is purely additive (3 new tables, all RLS-protected) — no destructive rollback SQL is required. If already applied, the app degrades gracefully because nothing outside `lib/business/*` and `/api/business/*`/`/student/business/*` reads these tables.
