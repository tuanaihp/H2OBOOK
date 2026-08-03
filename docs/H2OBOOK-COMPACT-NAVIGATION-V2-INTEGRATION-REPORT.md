# H2OBOOK Compact Navigation Upgrade V2 — Integration Report

Branch: `feat/compact-learner-navigation-v2` (on top of `feat/h2obook-learning-intelligence-v3`)
Source module: `v5/9-h2obook-compact-navigation-upgrade-v2`
Status: **READY_FOR_VERCEL_PREVIEW**

## 1. Audit summary

- Public landing (`/`, `/academy/**`) and the existing Admin/Owner workspace navigation (`components/layout/sidebar.tsx`, used by `/dashboard`, `/books`, `/editor`, etc.) already implement the exact HOME/LEARN/CREATE/TEACH/BUSINESS/SYSTEM domain grouping the source module describes as the target for admins — so per the module's own rule ("Admin/Owner giữ nguyên... và các submenu hiện tại"), **that navigation was left completely untouched**.
- The actual target of this upgrade is the **student shell**: `components/student/student-shell.tsx`, previously a single flat list of 8 links (Tổng quan, Khóa học, Thư viện, Bài tập, Thiết kế, Lộ trình, Mentor, Hồ sơ) with no grouping.
- The instructor shell (`SimpleOperationsShell` + `instructorRoutes`, used by `/instructor/**`) is a separate, already-reasonably-compact nav (5 items after module 8 added Brain Studio) — left untouched; the module's "TEACH" group requirement is satisfied by this existing shell, not duplicated.
- Public share pages / route guards for guests: no sidebar is ever rendered for `user.demo`/logged-out visitors on `/`, `/academy/**` — confirmed unchanged, no new code path added there.

## 2. Files added/changed

- `lib/student/compact-navigation.ts` (new) — ported from `src/domain/{compact-types,feature-access,compact-navigation}.ts`, adapted: `UserAccessContext` simplified to `{ role, subscription }` (this repo does not yet have the module's imagined multi-tier `SubscriptionTier`/`FeatureGrant`/roadmap-stage-grant model — see §6), `buildCompactNavigation()` returns real `href`s pointing at existing `/student/**` and `/instructor/**` routes instead of the module's placeholder `/learn`, `/create/*`, `/teach/*` paths.
- `components/student/student-shell.tsx` — sidebar now renders `buildCompactNavigation()`'s groups (HOME / LEARN / CREATE if unlocked / BUSINESS) with group labels, instead of the old flat 8-item list. Mobile bottom nav now derives from the same grouped list (first 5 items) instead of a separate hardcoded slice.
- `components/student/smart-home-roadmap-widget.tsx` (new) — renders **all** career-roadmap stages (not just the current one) with locked/active/completed state and the unlock reason for locked stages, per §"Smart Home" of the source prompt ("Stage locked vẫn hiển thị với lý do mở khóa nhưng không tạo menu").
- `app/student/page.tsx` — the old single-stage "Mốc nghề nghiệp hiện tại" card is replaced by `<SmartHomeRoadmapWidget>` on the existing Smart Home page (`/student`); everything else on the page (today's mission, mentor card, continue-learning, skill map, assignments, achievements) is unchanged.
- `app/globals.css` — small additive CSS block for `.h2oc-nav-group`/`.h2oc-nav-group-label` (sidebar group headers) and `.h2oc-roadmap-*` (the new widget). No existing selector was modified.

No SQL migration in this module, matching the source prompt's explicit "Không chạy SQL mới vì patch này không yêu cầu thay schema."

## 3. New sidebar structure (student)

| Group | Items | Destination |
|---|---|---|
| HOME | Smart Home | `/student` (unchanged route, now also hosts the roadmap widget) |
| LEARN | Hành trình học · Thư viện học · Thực hành & đánh giá | `/student/courses` · `/student/library` · `/student/assignments` |
| CREATE (shown only if unlocked) | Dự án của tôi · Công cụ của tôi | `/student/design-library` · `/student/mentor` |
| BUSINESS | Knowledge Store · Quyền lợi & đơn hàng | `/academy/courses` · `/student/courses` (see §6 — no dedicated orders page exists yet) |

`/student/roadmap` and `/student/profile` are **not deleted** (per the module's "không xóa dữ liệu" rule) — they keep working, just are no longer separate top-level sidebar entries: roadmap is reached via the new Smart Home widget, profile via the existing topbar avatar link (`.h2o-student-user`, unchanged).

## 4. Feature-gating

`hasFeature()`/`hasAnyFeature()` ported as pure functions. In this repo's current data model every logged-in student already has `learn.journey`, `learn.library`, `learn.practice`, `create.learning_journal`, and `business.storefront` (all `BASIC_FEATURES`, granted to any non-guest role) — there is no per-student granular tool entitlement system yet, so the CREATE group's unlock condition (`hasAnyFeature(context, CREATE_TOOL_FEATURES)`) is effectively always true for a real student today. The gating code is real and will start actually gating the moment `subscription`/`grants` are wired to real membership tiers (see §6) — it is not a no-op stub.

## 5. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 0 new warnings |
| `pnpm test` (vitest) | ✅ 21 files / 69 tests passed, no regressions (no new unit tests added for `hasFeature`/`buildCompactNavigation` — see §6) |
| `pnpm test:sql` | ✅ passed (no schema change in this module) |
| `pnpm validate:migrations` | ✅ 26 sequential migrations (unchanged by this module) |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully |

Not executed: Playwright E2E and a real multi-role click-through (guest/basic/membership/instructor/admin) against a deployed preview, since this session has no browser to click through — see §6.

## 6. Risks / TODO (explicitly deferred)

- **No live click-through verification** across the 5 required test personas (guest, basic, membership, course-purchase, instructor, admin) from §"Test bắt buộc" of the source prompt — this needs a Vercel Preview + manual pass, or Playwright, neither of which ran in this session.
- **`UserAccessContext` is simplified**: real `SubscriptionTier`/`FeatureGrant`/roadmap-stage-unlock wiring (reading actual `memberships`/`entitlements`/`academy_skill_progress` rows to decide `subscription` and per-feature grants) was not built — `student-shell.tsx` currently always passes `subscription: "basic"`. The domain logic (`hasFeature`, `buildCompactNavigation`) is real and ready; only the "read real entitlement data into `UserAccessContext`" wiring is deferred.
- **BUSINESS → "Quyền lợi & đơn hàng"** points at `/student/courses` (the closest existing screen showing what a student has access to) rather than a dedicated orders/payment-history page, because no such page exists in this repo yet. Building one was out of scope for this pass.
- **ContextualTabs** (the per-page tab bars specified for each of the 7 destination pages, e.g. "Tổng quan | Đang học | Giai đoạn | Tiến độ | Kết quả" under Hành trình học) were **not implemented** — the existing `/student/courses`, `/student/library`, `/student/assignments`, `/student/design-library`, `/student/mentor` pages already carry their own content and were left as-is rather than retrofitted with a new tab-bar layer. `getContextualTabs()`/`ContextualTab` from the source module were not ported.
- **PublicLandingGuard** component from the source module was not copied — it wasn't needed: no sidebar is rendered on `/` or `/academy/**` in this codebase already (confirmed by audit, §1), so there's nothing to guard.

## 7. Safe merge steps

1. Manually click through `/student` (grouped sidebar + roadmap widget), `/student/mentor` via the new "Công cụ của tôi" link, and confirm `/instructor/**` and `/dashboard` are visually unchanged, on a Vercel Preview.
2. No database change to apply — this module is UI-only.
3. Get product-owner confirmation before merging to `main`.
4. Rollback: revert `components/student/student-shell.tsx` and `app/student/page.tsx` to restore the flat 8-item nav and single-stage card; the two new files and the CSS append are inert if unused.
