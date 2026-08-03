# H2OBOOK Academy Control Center V1 — Integration Report

Branch: `feature/academy-control-center-v1`
Source module: `v5/15-h2obook-academy-control-center-v1`
Status: **READY_FOR_VERCEL_PREVIEW**

Same standing instruction as prior passes: audit before coding, reuse existing tables/engines,
never claim completion without real verification.

## 1. Audit summary + consistency findings

- **The source module proposes a full parallel content model** (`ContentAsset`, `Lesson`, `Course`, `CourseModule`, `Roadmap`, `EntitlementGrant`, `Enrollment`, `QualityIssue` — its own `types.ts`). This repo already has real, live, RLS-protected tables covering almost all of it: `public.academy_courses`/`academy_course_modules`/`academy_course_lessons` (migration 0024) already have a full `draft → active/published → archived` status workflow, video fields (`video_provider`/`video_playback_id`/`video_url`), `skill_keys`, and a `content jsonb` field — and `public.entitlements` (0001) already models exactly what `EntitlementGrant` proposes (`resource_type`/`resource_id`/`source_type`/`status`/`expires_at`). **No parallel Course/Lesson/Entitlement tables were created.** This is the same "Case C adapter" discipline used in every prior module this session.
- **Confirmed there was previously no admin UI to create or edit courses/modules/lessons at all** — `academy_courses` rows only ever get created by `ensureAcademyCatalogProduct()` seeding from the static catalog in `lib/public-site/content.ts`. This is a real, previously-unfilled gap; the Course Builder this pass ships is genuinely new capability, not a re-skin of something that already existed.
- **`public.entitlements` had a SELECT-only RLS policy and no write policy for staff at all** — every existing write happens through `mark_order_paid()`, a `security definer` function that bypasses RLS entirely. The source module's Phase 8 ("Manual grant must require: User, Resource, Start date, Expiry, Reason, Granting actor, Audit event") cannot be satisfied without both an admin-facing write path and two columns (`reason`, `granted_by`) that didn't exist. Migration 0031 adds exactly those two additive columns, the missing admin INSERT/UPDATE policies, and reuses the existing `capture_domain_event()` trigger (0007) for the audit event — no new audit table.
- **The source module's `AcademyRole` includes system_admin/academy_admin/content_manager/reviewer/operations_manager/admissions/support_agent** — none exist as real `public.member_role` values (same reconciliation as modules 12/13/14). `AcademyRole` here is narrowed to the repo's real roles; every capability this pass implements is admin/owner only. The existing `academy_courses`/`academy_course_modules`/`academy_course_lessons` RLS ("admin write" policies from 0024) is actually broader — it also allows `teacher` — but this pass's own `/academy-admin/*` application layer restricts access to admin/owner only, narrower than what the underlying (pre-existing, untouched) RLS would technically allow, mirroring the same "app-layer narrows what legacy RLS already grants broadly" pattern used in module 12.
- **Confirmed `/instructor/brain-studio` (module 8) already covers H2O Brain lesson-block authoring** (`knowledge_spaces`/`learning_blocks`) for Knowledge-Space-linked lessons — the source module's "Course and H2O Brain Builder" (Phase 6, the 12-block lesson structure: Objective/Video/Deep content/.../Save to portfolio) is a distinct, larger concept than the simple `academy_course_lessons.content jsonb` field this pass edits. Building the full 12-block structured lesson editor was judged out of scope for this pass (§5) — the Course Builder shipped here edits title/description/video/duration/status/skill_keys on the existing lesson row, not a block-based body.
- Confirmed `resolveAcademyOrganization()`/`configuredAcademyOrganizationId()` (`lib/academy/service.ts`) already exist and are reused directly for organization resolution — no new resolver was written.

## 2. Files added/changed

**Database** (`supabase/migrations/0031_h2obook_academy_control_center_v1.sql`)
- `public.entitlements`: two additive columns (`reason`, `granted_by`), two new RLS policies (admin/owner INSERT and UPDATE — the existing SELECT policy from 0001 was left untouched), and a `capture_domain_event` trigger for audit.
- No new tables. Grepped every new identifier against 0001–0030 before finalizing — no collisions.

**Server logic (`lib/academy-admin/*`, all new)**
- `types.ts` — narrowed `AcademyRole`, plus `CourseSummary`/`CourseDetail`/`ModuleRow`/`LessonRow` shaped directly around the real `academy_courses`/`academy_course_modules`/`academy_course_lessons` columns.
- `access.ts` — `capabilitiesForRole()`, admin/owner get every implemented capability, everyone else gets none.
- `request.ts` — `resolveAcademyAdminAccess()`, mirroring `lib/teaching/request.ts`/`lib/business/request.ts`/`lib/system/request.ts`.
- `courses.ts` — `listCourses`/`getCourseDetail`/`createCourse`/`updateCourse`/`createModule`/`updateModule`/`createLesson`/`updateLesson`, all real reads/writes against the existing academy tables.
- `dashboard.ts` — `getAcademyDashboardSummary()`, real counts only (total/active courses, total/published lessons, pending applications, active students) — no demo metrics (rule 11).
- `entitlements.ts` — `findStudentByEmail`/`grantManualEntitlement`/`listManualGrants`/`revokeManualGrant`.

**API routes (`app/api/academy-admin/*`, all new)**
`dashboard`, `courses` (GET/POST), `courses/[id]` (GET/PATCH), `courses/[id]/modules` (POST), `modules/[id]` (PATCH), `modules/[id]/lessons` (POST), `lessons/[id]` (PATCH), `students/lookup`, `entitlements` (GET/POST), `entitlements/[id]/revoke`.

**UI**
- `app/academy-admin/page.tsx` + `academy-dashboard-client.tsx` — Dashboard with real course/lesson/application/student counts.
- `app/academy-admin/programs/page.tsx` — course list + create form.
- `app/academy-admin/programs/[id]/page.tsx` — course detail: inline title/description edit, publish/hide toggle, add/publish modules, add/publish lessons — all real writes.
- `app/academy-admin/distribution/page.tsx` — Distribution & Entitlement Center: find student by email, grant course access with expiry + required reason, view/revoke manual grant history.
- `lib/operations/feature.ts` — `academyControlCenter` flag (`NEXT_PUBLIC_ACADEMY_CONTROL_CENTER_V1`), satisfying rule 8's explicit feature-flag requirement.
- `lib/operations/routes.ts` — `academyAdminRoutes`.
- `components/layout/sidebar.tsx` — one new conditional link, same pattern as `/system` and `/operations`.

## 3. Security implementation

- Every `/api/academy-admin/*` route calls `resolveAcademyAdminAccess()` first — role is always re-resolved server-side from the session via `resolveOrganizationAccess()`, never trusted from the client.
- `app/academy-admin/page.tsx` additionally re-checks admin/owner server-side and redirects to `/dashboard` before rendering, same defense-in-depth pattern as `/system`.
- Manual entitlement grants require a non-empty `reason`, are always stamped with `granted_by: access.userId` (never client-supplied), and are only ever inserted through the user-scoped RLS client — the new "entitlements admin manual grant insert" policy (0031) independently re-enforces admin/owner at the database layer even if the API check were ever bypassed.
- `findStudentByEmail` scopes the lookup to `organization_members.organization_id = access.organizationId` — an admin cannot look up or grant access to a user outside their own organization.

## 4. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 51 warnings (50 pre-existing + 1 new `react-hooks/exhaustive-deps` on the course detail page's `load()` call — the same accepted pattern already present elsewhere in this codebase, e.g. `student/create/projects/[id]/page.tsx`) |
| `pnpm test` (vitest) | ✅ 21 files / 69 tests passed, no regressions |
| `pnpm test:sql` | ✅ passed |
| `pnpm validate:migrations` | ✅ 31 sequential migrations |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; all `/api/academy-admin/*` routes and `/academy-admin/*` pages present in the route manifest |

Not executed: live multi-role click-through, Playwright E2E — no browser in this session.

## 5. Risks / TODO (explicitly deferred, not silently dropped)

- **Media Center (Phase 5) was not built.** No dedicated Academy-specific R2 upload/signed-URL flow was added; lessons currently take a plain `video_url` string. The existing generic asset pipeline (`lib/assets/*`, `/assets`) was not wired in — a real integration (direct-to-R2 signed upload, thumbnail/subtitle metadata, "where is this media used") is its own scoped piece of work.
- **Roadmap Builder (Phase 7) was not built.** No `Roadmap`/`RoadmapNode` table exists (same finding as module 13's audit — `studentCareerStages` is static demo data, not per-user or admin-editable).
- **Learning Experience settings, Quality & preflight (Phase 10), and Role Preview (Phase 9) were not built.** No content-specific preflight/quality-issue engine exists for academy content (the existing `/preflight`/`content-health` pages are for the book editor); Role Preview would need a single canonical access resolver shared with the real student app, which doesn't exist as one function yet.
- **Account creation on behalf of students (Phase 11) was not built** — this explicitly depends on Operations' CRM & Admissions screens, which module 14's audit already found to be 100% demo-backed; wiring this now would sit on top of a UI that doesn't read real data yet.
- **The Course Builder edits a single `content jsonb` field per lesson, not a structured 12-block body** (Objective/Video/Deep content/Images/Step-by-step/Mistakes/Case study/Downloads/Assignment/Quiz/Share/Portfolio). Module 8's Knowledge Space block editor (`learning_blocks`) is the closer real precedent for that structure but is a separate content type (Knowledge Spaces, not `academy_course_lessons`) — unifying them is future work.
- **Instructor/Content Manager delegated capabilities (Phase 3) are not implemented** — only admin/owner can reach `/academy-admin/*` this pass.
- No Playwright E2E role matrix was run (no browser available in this session).

## 6. Rollback

- Revert the merge commit on `main`, or `git revert` this module's commit range.
- Database: migration 0031 is purely additive (2 new columns, 2 new RLS policies, 1 new trigger on an existing table) — no destructive rollback SQL is required. If already applied, nothing outside `lib/academy-admin/*` and `/api/academy-admin/*`/`/academy-admin/*` reads `entitlements.reason`/`granted_by`.
