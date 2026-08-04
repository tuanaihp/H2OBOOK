# H2OBOOK — Production Gap Audit (Phase 0)

Status: **AUDIT ONLY. No production logic changed, no migration run, no schema changed.**
This document is the Phase 0 deliverable requested. It does not implement H2OKOC/Autovis and
does not re-run the Data Dictionary audit (`docs/DATA_DICTIONARY_MAIN_AUDIT.md`) — that audit's
domain/schema findings are referenced, not repeated.

Method: direct source inspection (route files, middleware, auth components, API routes, Supabase
migrations 0001–0031) plus targeted grep evidence for every claim below. No runtime/browser
testing was performed in this pass (no live environment access) — see §7 "Chưa xác minh runtime".

---

## 1. Executive Summary

**What already runs on real Supabase data today** (built across this project's prior integration
passes, verified again in this audit):
- Public Academy catalog (`/academy/*`) — real `academy_courses`/`academy_course_modules`/
  `academy_course_lessons`, admin-authored via `/academy-admin/programs`.
- Academy application/lead intake (`/api/academy/applications`) — real insert, real error
  handling (no fake success on DB failure), real duplicate detection, real UTM/consent capture,
  real bridge into Operations CRM (`admission_leads`), real transactional email with dedupe.
- Student learning core: `/student`, `/student/courses`, `/student/courses/[slug]`,
  `/student/roadmap`, `/student/learn`, `/student/create/*`, `/student/business/*`,
  `/student/assignments` (submission side is real; see §4 for the display-side gap) — real
  server-side data via `requireCurrentUser()` + real tables.
- Teaching (`/instructor/*`) — real Supabase-backed Command Center, Student Success, Class view,
  Feedback Studio.
- System health (`/system`) and Academy content authoring (`/academy-admin/*`) — real.
- Payments: order → `mark_order_paid()` → entitlement/membership grant — real, idempotent
  (`payment_events.provider_event_id` dedupe confirmed in source), webhook-driven, not
  client-trusted.
- R2 storage: real signed upload/download (`lib/storage/r2.ts`, `aws-sdk/s3-request-presigner`),
  workspace-scoped object keys, MIME/size validation, per-student quota check.
- Auth: real Supabase Auth, real `redirectTo`-equivalent (`?next=`) flow with open-redirect
  guarding, in both the legacy and V2 login forms.

**What is still UI-only / demo data** (client-side Zustand store, not Supabase):
- The entire legacy Admin Workspace surface: `/dashboard`, `/store`, `/orders`, `/membership`,
  `/analytics`, `/marketplace-studio`, `/licensing`, `/white-label`, `/growth-reader`, `/security`,
  `/admin`, `/enterprise`, `/integrations`, `/cloud-sync`, `/offline`, `/smart-settings`,
  `/assist-control`, `/settings`, `/students`, `/class-view`, `/reviews`, `/collaboration`,
  `/automations`, `/processing`, `/assignments`, `/quizzes`, `/classes`, `/assets`, `/blocks`,
  `/brand-kit`, `/bulk-publishing`, `/content-health`, `/design-library`, `/knowledge`,
  `/library`, `/preflight`, `/publish`, `/study`, `/templates`, `/customer/*`, `/ai-studio`.
- Operations Center (`/operations` + 8 sub-pages) and Platform Admin (`/platform-admin` + 3
  sub-pages) — both still Zustand-only despite Operations having real backing tables
  (`admission_leads`, `support_tickets`, `approval_requests` from migration 0025).
- Three Student Portal pages specifically: `/student/profile`, `/student/library`,
  `/student/assignments` (the list/display view — see §4.4) still show fabricated numbers/text
  to a real logged-in student.
- Several `*-preview` routes are explicitly-named demo surfaces
  (`academic-ops-v2-preview`, `business-ops-v1-preview`, `creative-publishing-v1-preview`,
  `system-governance-ops-v2-preview`, `academy/home-v3-preview`, `academy/neural-system-preview`,
  `academy/public-suite-v5-preview`) — not a hidden gap, but reachable by direct URL with no
  "this is a preview" banner and no auth gate beyond the normal middleware rules.

**What is broken/incomplete with source evidence** — see §4 Confirmed Gaps. Highlights:
one real permission-scope gap (P0), one silent-failure auth edge case (P1), one mobile-UX defect
with exact CSS evidence (P1), missing per-entity SEO metadata (P2), no dedicated Unauthorized /
Coming Soon page states (P1/P2), Reader bookmark/note persistence still client-only (P1, already
flagged in a prior report, cross-referenced here).

**Nothing was found that doesn't exist at all** in the sense of "completely unbuilt core
capability" — every domain the prompt asks about (Create, Learn, Teach, Business, Operations,
System) has real code and real tables; the gaps are about **which surfaces are wired to that real
data and which still show a client-side demo store**, plus a handful of concrete auth/UX/SEO
defects.

---

## 2. Route Matrix

Status values used (per the prompt's fixed vocabulary): `implemented_working`,
`implemented_broken`, `implemented_mock`, `protected_unverified`, `planned`, `redirect`,
`unauthorized`, `not_found`.

`protected_unverified` = middleware requires auth and the page reads real Supabase data, but no
live runtime/browser test was performed in this pass to confirm the full flow end-to-end.

### 2.1 Public / marketing

| Route | Auth | Data source | Status |
|---|---|---|---|
| `/` | public | static content + curated catalog | implemented_working |
| `/academy` | public | `academy_courses` etc. (real) | implemented_working |
| `/academy/about`, `/strategies`, `/strategies/[slug]`, `/success-stories`, `/learning-paths` | public | mixed static + catalog | implemented_working |
| `/academy/books`, `/academy/books/[slug]` | public | catalog | implemented_working (detail page has no per-book metadata — §4.5) |
| `/academy/courses`, `/academy/courses/[slug]` | public | `academy_courses` (real) | implemented_working (detail page has no per-course metadata — §4.5) |
| `/academy/membership` | public | static plan content | implemented_working |
| `/academy/knowledge-universe` | public | static | implemented_working |
| `/academy/home-v3-preview`, `/academy/neural-system-preview`, `/academy/public-suite-v5-preview` | public (no gate) | static preview data | implemented_mock (explicitly a preview surface, not a hidden gap) |
| `/login`, `/signup` | public (redirects away if already authenticated) | Supabase Auth | implemented_working (see §4.1–4.3 for specific defects) |
| `/auth/callback` | public | Supabase Auth code exchange | implemented_broken (§4.2) |
| `/auth/accept-invite` | public | Supabase Auth | protected_unverified |
| `/verify/[certificateNo]`, `/verify-outcome/[slug]` | public | real tables | implemented_working |
| `/portal/[slug]` | public | white-label portal config | protected_unverified |
| `/embed/[slug]` | public | protected embed config | protected_unverified |
| `/reader/[slug]` | public/entitlement-gated | `books`/`book_pages` (real) | implemented_working (bookmarks/notes are localStorage-only — §4.6) |

### 2.2 Student Portal (`/student/*`)

| Route | Data source | Status |
|---|---|---|
| `/student` (Smart Home) | hybrid: Zustand demo base + real `live.todayTasks`/`live.skillMastery` overlay from `/api/student/summary` | implemented_working (hybrid, by design — module 11) |
| `/student/courses`, `/student/courses/[slug]` | real (`getStudentCourseSummaries`) | implemented_working |
| `/student/roadmap` | real skill progress overlay on a static stage list | implemented_working |
| `/student/learn` | real (module 11) | implemented_working |
| `/student/create`, `/student/create/new`, `/student/create/projects`, `/student/create/projects/[id]` | real (module 10) | implemented_working |
| `/student/business`, `/student/business/customers`, `/student/business/growth`, `/student/business/operations` | real (module 13) | implemented_working |
| `/student/mentor` | local rule-based responses (`localMentorResponses`), no AI, no DB persistence of conversation | implemented_working (as designed — no-AI-first) |
| `/student/spaces/[slug]` | real (Knowledge Space reader, module 8) | implemented_working |
| `/student/design-library` | protected_unverified | protected_unverified |
| `/student/profile` | 100% Zustand demo store, hardcoded stats/certificates/portfolio | **implemented_mock** (§4.4) |
| `/student/library` | 100% Zustand demo store (`store.books`), hardcoded reading % | **implemented_mock** (§4.4) |
| `/student/assignments` | 100% Zustand demo store (`store.assignments`), hardcoded counts/status by array index | **implemented_mock** (§4.4) |

### 2.3 Teaching (`/instructor/*`) and Academy Admin

| Route | Data source | Status |
|---|---|---|
| `/instructor`, `/instructor/classes`, `/instructor/students`, `/instructor/assessments` | real (module 12) | implemented_working |
| `/instructor/brain-studio`, `/instructor/brain-studio/[spaceId]` | real (module 8) | implemented_working |
| `/academy-admin`, `/academy-admin/programs`, `/academy-admin/programs/[id]`, `/academy-admin/distribution` | real (module 15) | implemented_working |

### 2.4 System Control Plane

| Route | Data source | Status |
|---|---|---|
| `/system` | real, live health score (module 14) | implemented_working |

### 2.5 Legacy Admin Workspace (`/dashboard` + sidebar tree) — all client-side demo

| Route | Data source | Status |
|---|---|---|
| `/dashboard`, `/books`, `/editor/[bookId]`, `/editor/[bookId]/compose`, `/remix/[bookId]` | Zustand + IndexedDB, local-first, syncs to real `books`/`book_pages` via cloud-save | implemented_working (this is the one legacy-workspace area that IS real — see §1) |
| `/assets`, `/ingestion`, `/blocks`, `/brand-kit`, `/templates`, `/design-library`, `/clones`, `/bulk-publishing`, `/content-health`, `/publish` | Zustand demo store | implemented_mock |
| `/store`, `/orders`, `/membership`, `/analytics`, `/marketplace-studio`, `/licensing`, `/white-label`, `/growth-reader` | Zustand demo store | implemented_mock |
| `/students`, `/class-view`, `/reviews`, `/collaboration`, `/automations`, `/processing`, `/assignments`, `/quizzes`, `/classes`, `/knowledge`, `/library`, `/preflight`, `/study` | Zustand demo store | implemented_mock |
| `/admin`, `/enterprise`, `/integrations`, `/cloud-sync`, `/offline`, `/security`, `/account`, `/smart-settings`, `/assist-control`, `/settings` | Zustand demo store (`/security` partially reads a real session endpoint — mixed) | implemented_mock |
| `/customer`, `/customer/onboarding`, `/customer/orders`, `/customer/payments` | Zustand demo store | implemented_mock |
| `/ai-studio` | Zustand demo store | implemented_mock |
| `/operations` + `/operations/{admissions,approvals,automation-center,import-center,notifications,product-config,support,system-health}` | Zustand demo store (real backing tables exist unused — 0025) | implemented_mock |
| `/platform-admin` + `/platform-admin/{organizations,plans,system-health}` | Zustand demo store | implemented_mock |

**No role/permission gate exists on any route in this whole section beyond "must be logged in and
not a student"** — see §4.1 (P0).

### 2.6 Preview/demo surfaces (explicitly named `-preview`)

| Route | Status |
|---|---|
| `/academic-ops-v2-preview/*` (10 sub-routes), `/business-ops-v1-preview/[surface]`, `/creative-publishing-v1-preview/[surface]`, `/system-governance-ops-v2-preview/[surface]` | implemented_mock — reachable by any authenticated non-student user, no preview banner |

### 2.7 Not found / error handling

| Route | Status |
|---|---|
| `app/not-found.tsx` | implemented_working (real Next.js 404) |
| `app/error.tsx` | implemented_working (real Next.js error boundary) |
| Dedicated "Unauthorized" page | **not_found** — no such page exists; access failures are handled by silent redirect, not a distinct Unauthorized/Access-Required/Membership-Expired UI state (§4.7) |
| Dedicated "Coming Soon" page | **not_found** — no such pattern exists in the codebase |

---

## 3. Domain Source-of-Truth Matrix

This repeats only the domains the prompt asks for that were **not** already fully covered in
`docs/DATA_DICTIONARY_MAIN_AUDIT.md` §2, or adds the RLS/owner/risk columns that document didn't
carry. For domains already tabulated there (Course, Lesson, Book, Asset, Class, Membership,
Product, Order, Entitlement, Audit), see that document — not repeated verbatim here.

| Domain | Source-of-truth table | Legacy/parallel table | Writer | Reader (UI) | RLS | Owner col | Workspace scope | Duplicate risk | Minimum fix |
|---|---|---|---|---|---|---|---|---|---|
| User | `profiles` | — | Supabase Auth trigger + `lib/auth/current-user.ts` | everywhere | `profiles` self-read/staff-read | `id` | via `organization_members` | none | none |
| Workspace | `organizations` | — | seed/admin | everywhere | org-member read | — | is-the-scope | none | none |
| Role | `organization_members` | — | admin invite flow | `requireCurrentUser`, `resolveOrganizationAccess` | self + staff read | `user_id` | `organization_id` | none | none |
| Student (as identity) | `profiles` + `organization_members.role='student'` | — | signup/invite | `/student/*`, `/instructor/students`, `/academy-admin` | as above | `id` | via membership | none | none |
| Learning progress | `academy_lesson_progress` / `block_progress` / `knowledge_space_progress` | none (two systems track two different content types — documented not-a-conflict in Data Dictionary §5.1) | server routes | `/student/courses`, `/student/roadmap`, `/student/learn` | self-read | `user_id` | `organization_id` | none | none |
| Assignment | `assignments` (classroom) / `assignment_definitions` (Brain) | none — different systems, kept intentionally separate (Data Dictionary §5.3) | admin/instructor | `/instructor/assessments` (real), `/student/assignments` (UI still demo — §4.4) | staff write, student-self read | `created_by` | `organization_id` | **display-side gap, not schema** | wire `/student/assignments` to real `assignment_submissions`/`brain_assignment_submissions` rows for the signed-in user |
| Submission | `assignment_submissions` / `brain_assignment_submissions` | none | student (create), instructor (grade) | `/instructor/assessments` (real) | owner + staff | `student_id`/`user_id` | `organization_id` | none | none |
| Quiz | `quizzes`/`quiz_questions`/`quiz_attempts` | none | admin (authoring), student (attempt) | `/quizzes` (workspace demo page), `/api` layer real | owner + staff | `user_id` on attempts | `organization_id` | none | **UI not wired** — `/quizzes` is still the legacy demo page; no student-facing quiz-taking UI reads real `quiz_attempts` yet (confirmed absent) |
| Class | `classes`/`class_members` | none | admin/teacher | `/instructor/classes` (real), `/class-view`/`/classes` (demo) | teacher-scoped + org staff (broader than app layer — already documented, module 12) | `teacher_id` | `organization_id` | none | none |
| Notification | `notifications` | none | server (various) | `/operations/notifications` (demo page, real table unused) | self-read | `user_id` | `organization_id` | none | wire `/operations/notifications` to the real table, or defer with a documented reason |
| Approval | `approval_requests` (0025) / `review_requests` (0003) | **two systems for two different approval concepts** — `review_requests` is content/publishing review (books, designs), `approval_requests` is the Operations-generic approval queue. Not confirmed to be a true duplicate without a human decision on whether these should ever merge. | admin | `/operations/approvals` (demo page, real table unused), `/reviews` (demo page) | staff | `requested_by` | `organization_id` | **flagged for human decision**, not auto-merged | document intended scope difference explicitly, or merge with a dedicated pass |
| Support ticket | `support_tickets` (0025) | none | admin/student | `/operations/support` (demo page, real table unused) | staff + requester | `requester_id` | `organization_id` | none | wire the UI |
| Audit | `domain_events` (standard, `audit_logs` now frozen — see recent standardization commit) | `audit_logs` (frozen, no new writers) | trigger-based | none dedicated yet | org-member read | `actor_id` | `organization_id` | resolved | build a read UI if/when needed |

---

## 4. Confirmed Gaps

Every gap below has direct source evidence (file + line-level grep quoted). No gap is speculative.

### 4.1 [P0] No role/permission gate on the entire legacy Admin Workspace route tree
- **Hiện trạng**: `middleware.ts` only has two authorization rules: (a) redirect unauthenticated
  users to `/login`, (b) redirect `role === "student"` sessions to `/student` for any non-`/student`
  path. There is no rule restricting `/admin`, `/security`, `/operations/*`, `/platform-admin/*`,
  or any of the ~40 legacy workspace routes to `admin`/`owner` roles.
- **Bằng chứng**: `middleware.ts` — the only two conditionals that redirect are the unauthenticated
  check and the `memberRole === "student"` check; no third branch checks `memberRole` against
  `admin`/`owner` for any other route. A `teacher`, `designer`, or `partner` session can navigate
  directly to `/admin`, `/platform-admin`, `/security`, etc.
- **Tác động**: any non-student, non-admin real account (teacher/designer/partner) can currently
  reach every legacy Admin/Operations/Platform-Admin page. Actual data exposure is limited today
  because most of those pages still read the client-side Zustand demo store (§2.5) rather than
  real per-workspace Supabase data — but this is a permission defect regardless of what data
  happens to be behind it today, and it becomes a real cross-workspace data leak the moment any
  more of those pages are wired to Supabase (as `/operations/*` and `/platform-admin/*` are
  explicitly expected to be per this same prompt's own priorities).
- **File liên quan**: `middleware.ts`.
- **Schema liên quan**: none (this is an application-layer gate, not an RLS gap — RLS on the
  underlying tables is separately correct).
- **Cách sửa tối thiểu**: add one additional middleware branch: if `memberRole` is not
  `admin`/`owner` and `pathname` matches the legacy admin/operations/platform-admin route
  prefixes, redirect to a dedicated Unauthorized page (§4.7) instead of rendering the page.
- **Rủi ro**: must not accidentally block `teacher` from routes teachers legitimately use (e.g.
  `/books`, `/editor/*` — the real, local-first authoring surface). Requires an explicit
  allow-list, not a blanket deny, and should ship alongside §4.7's Unauthorized page so the
  failure mode is visible rather than a confusing silent redirect.
- **Rollback**: revert the middleware change; no data or schema involved.
- **Acceptance criteria**: a `teacher`/`designer`/`partner` session hitting `/admin`,
  `/operations`, `/platform-admin`, `/security` gets a real Unauthorized page, not the page
  content; `owner`/`admin` sessions are unaffected; `/books`/`/editor/*` remain reachable by
  the roles that already legitimately use them today.

### 4.2 [P1] Auth callback silently proceeds without a session on expired/missing OAuth code
- **Hiện trạng**: `app/auth/callback/route.ts` calls `supabase.auth.exchangeCodeForSession(code)`
  without checking its return value for an error, and does nothing distinct if `code` is absent —
  it always redirects to `next` (or `/dashboard`) regardless of whether the session exchange
  actually succeeded.
- **Bằng chứng** (full route body): `if(code&&supabase){await supabase.auth.exchangeCodeForSession(code);await supabase.rpc("claim_my_pending_access");}return NextResponse.redirect(new URL(next,url.origin));` — the `exchangeCodeForSession` result is never inspected.
- **Tác động**: a user whose invite/magic-link is expired lands on `next` (or `/dashboard`) with
  no session and no error message, rather than being told the link expired — they'll just look
  logged out with no explanation, or middleware will bounce them back to `/login` with no context
  on *why*.
- **File liên quan**: `app/auth/callback/route.ts`.
- **Schema liên quan**: none.
- **Cách sửa tối thiểu**: capture the `{ error }` from `exchangeCodeForSession`; on error or
  missing `code`, redirect to `/login?error=link_expired` (or similar) instead of `next`, and have
  the login page render a distinct message for that query param.
- **Rủi ro**: low — purely additive error branch.
- **Rollback**: revert the route file.
- **Acceptance criteria**: an expired/invalid invite link shows a clear "link expired, request a
  new one" message instead of a silent, unexplained non-login.

### 4.3 [P1] Mobile login: hero panel pushes the form below the fold on all three tested phone widths
- **Hiện trạng**: the active login experience (`PublicLoginExperience`, used whenever
  `NEXT_PUBLIC_AUTH_EXPERIENCE_V2 !== "false"`, i.e. by default) renders the marketing
  `brandPanel` **before** the `loginPanel` in DOM order. On screens ≤900px (covers all three
  required test widths: 360×800, 390×844, 430×932) the two-column grid collapses to one column,
  so the hero renders first and stacks above the form.
- **Bằng chứng**: `components/public-academy-v5/public-auth-v5.module.css` —
  `@media(max-width:900px){.authPage{grid-template-columns:1fr}.brandPanel{min-height:44vh;padding:3rem 1.5rem}...}`.
  A `min-height:44vh` hero on a 390×844 viewport is ~371px the user must scroll past (partially
  offset by `.loginCard{margin-top:-3rem}`, which is not enough to bring the form into the first
  viewport on the smallest tested width).
- **Tác động**: violates the explicit mobile requirement ("form đăng nhập xuất hiện sớm... không
  bắt người dùng kéo qua hero quá dài"). Does not block login functionally — only a UX defect.
- **File liên quan**: `components/public-academy-v5/public-auth-v5.module.css`,
  `components/public-academy-v5/public-login-experience.tsx`.
- **Cách sửa tối thiểu**: on the ≤900px breakpoint, either reorder `loginPanel` before
  `brandPanel` (CSS `order`, no JSX/DOM change needed) or shrink `brandPanel`'s `min-height`
  substantially (e.g. to a compact single-line brand strip) below ~900px.
- **Rủi ro**: low, pure CSS; must re-verify the hero doesn't collapse to 0 height or clip the
  logo/heading.
- **Rollback**: revert the CSS file.
- **Acceptance criteria**: on 360×800, 390×844 and 430×932 viewports, the email/password fields
  are visible without scrolling (or with materially less scrolling than today).

### 4.4 [P1] Three real, logged-in Student Portal pages still show fabricated data
- **Hiện trạng**: `/student/profile`, `/student/library`, and `/student/assignments` are "use
  client" pages reading exclusively from `useAppStore()` (the pre-Supabase Zustand demo store),
  not from the student's own real Supabase data — even though the student is a real, authenticated
  user and sibling pages (`/student/courses`, `/student/roadmap`, `/student/learn`) already do
  read real data for the same user.
- **Bằng chứng**:
  - `/student/profile`: hardcoded `<strong>68%</strong><small>Tiến độ tổng thể</small>`,
    `<strong>42 giờ</strong>`, a certificate literally dated `Cấp ngày 20/07/2026`, and a
    portfolio grid built from `Array.from({length:6},...)` with a hardcoded Vietnamese label
    array — none of this is queried from any table.
  - `/student/library`: `store.books.filter(...)`.map with a synthetic progress formula
    `{34+index*18}%` — not a real per-user reading-progress value.
  - `/student/assignments`: `store.assignments.map((assignment,index)=>...)` where the displayed
    status/label/photo-count is entirely derived from the array `index` (`index===0?"CẦN
    NỘP":index===1?...`), not from any real submission's actual state — while the *server-side*
    submission/grading system (`assignment_submissions`, `brain_assignment_submissions`, and the
    real Feedback Studio at `/instructor/assessments`) is fully real.
- **Tác động**: a real student sees fabricated achievement/progress/grade numbers that do not
  reflect their actual account state — directly contradicts "Student Portal không dùng demo data
  để giả tiến độ" (acceptance criterion #12).
- **File liên quan**: `app/student/profile/page.tsx`, `app/student/library/page.tsx`,
  `app/student/assignments/page.tsx`.
- **Schema liên quan**: `academy_skill_progress`/`academy_lesson_progress` (profile stats),
  `books`/`entitlements` (library — which books this student can actually read),
  `assignment_submissions`/`brain_assignment_submissions` (assignments — already real on the
  instructor side, just not read on the student list page).
- **Cách sửa tối thiểu**: convert each to a server component (or client + fetch, matching the
  `/instructor/*` pattern) reading the student's own real rows; keep the existing UI/markup,
  per the standing rule "giữ nguyên UI, không tạo lại module mới."
- **Rủi ro**: low-medium — `/student/assignments` needs a real query across two submission tables
  (legacy classroom + Brain-linked), same shape of work already done for `/instructor/assessments`'s
  unified queue (module 12) and directly reusable.
- **Rollback**: revert the three page files.
- **Acceptance criteria**: each page shows only the signed-in student's real data; empty states
  render correctly for a student with no submissions/books/achievements yet (no demo fallback
  used to "fill" an empty state).

### 4.5 [P2] Book/Course/Strategy detail pages have no per-entity metadata
- **Hiện trạng**: `/academy/books/[slug]`, `/academy/courses/[slug]`, `/academy/strategies/[slug]`
  export no `metadata`/`generateMetadata`, so every book/course/strategy page renders the root
  layout's default title: `"H2OBOOK 4.14 · AI Learning Universe"` regardless of which book/course
  is open.
- **Bằng chứng**: `grep -rln "generateMetadata|export const metadata" app/academy` returns only
  the 7 listing/static pages (`strategies`, `membership`, `learning-paths`, `courses`, `books`,
  `about`, `success-stories`) — none of the three `[slug]` detail pages. Root
  `app/layout.tsx:8`: `title: { default: "H2OBOOK 4.14 · AI Learning Universe", template: "%s | H2OBOOK" }`.
- **Tác động**: broken social share previews and search-result titles for every individual
  book/course/strategy page — all identical regardless of content.
- **File liên quan**: `app/academy/books/[slug]/page.tsx`, `app/academy/courses/[slug]/page.tsx`,
  `app/academy/strategies/[slug]/page.tsx`.
- **Cách sửa tối thiểu**: add `generateMetadata()` to each, deriving `title`/`description`/OG
  image from the already-fetched catalog entry (no new query needed — the data is already loaded
  to render the page body).
- **Rủi ro**: none — purely additive.
- **Rollback**: revert the three files.
- **Acceptance criteria**: each detail page's browser tab title and share preview reflects its
  actual title/description.

### 4.6 [P1] Reader bookmarks/notes/progress are `localStorage`-only despite real tables existing
- Already confirmed and reported in `docs/H2OBOOK-IMAGE-BOOK-TEACHING-UPGRADE-V1-INTEGRATION-REPORT.md`
  §5 — cross-referenced here per the instruction to consolidate all confirmed P0/P1 gaps in this
  document, not to re-audit. `bookmarks`/`reader_notes`/`reading_progress` tables (0001/0002) are
  real and RLS-ready; `app/reader/[slug]/page.tsx` persists to a `storageKey` in `localStorage`
  instead. Not re-investigated further in this pass.

### 4.7 [P1] No dedicated Unauthorized / Access-Required / Membership-Expired / Coming-Soon page states
- **Hiện trạng**: access-control failures are handled exclusively by redirecting to a different
  route (student → `/student`, unauthenticated → `/login`) — there is no page that explicitly
  tells the user *why* they were redirected (wrong role vs. no entitlement vs. expired membership
  vs. feature not yet built).
- **Bằng chứng**: `grep -rln "Unauthorized|Không đủ quyền|403"` and
  `grep -rln "Coming Soon|Sắp ra mắt|coming-soon"` across `app`/`components` both return zero
  files. `app/not-found.tsx` and `app/error.tsx` exist and are real, but nothing else does.
- **Tác động**: a user blocked for a permission reason and a user blocked because a route doesn't
  exist currently look identical (silent redirect) or, for true 404s, get the generic not-found
  page with no distinction from "you don't have access" vs "this isn't built yet."
- **File liên quan**: none yet — this is an absence, not a defect in an existing file.
- **Cách sửa tối thiểu**: add `app/unauthorized/page.tsx` (or a shared component rendered inline)
  covering the five states the prompt names (`unauthenticated`/`authenticated`/`unauthorized`/
  `entitlement_required`/`membership_expired`), and route §4.1's new middleware branch to it
  instead of a silent redirect.
- **Rủi ro**: low, purely additive.
- **Rollback**: remove the new page/route.
- **Acceptance criteria**: a wrong-role access attempt shows a real Unauthorized page; a
  wrong-entitlement access attempt (e.g. an unpurchased course) shows an Access-Required page,
  not a redirect to the homepage.

---

## 5. Duplicate Schema Audit

- **No duplicate tables found for any of the example groups the prompt names**
  (`courses/academy_courses/learning_courses`, `lessons/academy_lessons/course_lessons`,
  `assets/content_assets/academy_content_assets`, `entitlements/academy_entitlements/
  learning_user_entitlements`, `memberships/subscriptions/membership_plans`,
  `books/book_projects/published_books`, `students/profiles/academy_students`) — grepped every
  migration file, only one real table exists per concept in every one of these groups. This
  confirms and extends the same finding already made in `docs/DATA_DICTIONARY_MAIN_AUDIT.md` §0/§5.
- **No duplicate views, duplicate triggers, or migrations that would fail/duplicate on re-run**
  were found — every `create table`/`create policy`/`create trigger` in 0001–0031 uses
  `if not exists` or `drop ... if exists` guards consistently (spot-checked across all 31 files
  during this session's prior module work; no new violation found in this pass).
- **No mock data writing into a production table** was found — the one place that looked
  superficially like it (`lib/academy/demo-store.ts`, an in-memory `academyDemoState()`) is only
  used as a fallback when `isSupabaseConfigured()` is false, and every write path checks that flag
  before choosing between the demo store and a real `admin.from(...).insert(...)` call (confirmed
  in `app/api/academy/applications/route.ts`, §1).
- **One real "two systems, same concept name" pair flagged for a human decision, not auto-merged**:
  `approval_requests` (0025, Operations-generic queue) vs. `review_requests` (0003,
  content/publishing review) — see §3. Both are real, both have real RLS, both are read by
  currently-demo UI pages. Whether these should ever be unified is a product decision, not a
  schema bug — flagged, not resolved.
- **`audit_logs` vs `domain_events`**: already resolved in a prior pass (see the "Standardize
  audit logging on domain_events" commit) — `audit_logs` now has zero write call sites in the
  codebase. Listed here only for completeness, not as an open item.

---

## 6. Production Upgrade Plan

### P0 (permission/auth defect)
1. §4.1 — legacy Admin Workspace route tree has no role gate in middleware.

### P1 (important workflow incomplete/broken)
1. §4.2 — auth callback swallows expired/missing OAuth code errors.
2. §4.3 — mobile login hero pushes the form below the fold.
3. §4.4 — `/student/profile`, `/student/library`, `/student/assignments` show fabricated data to
   real students.
4. §4.6 — Reader bookmarks/notes/progress are `localStorage`-only (cross-referenced, not re-audited).
5. §4.7 — no Unauthorized/Access-Required/Membership-Expired/Coming-Soon page states.

### P2 (UX/SEO/polish)
1. §4.5 — no per-entity metadata on book/course/strategy detail pages.
2. Homepage (`app/page.tsx`) and `/login` have no explicit metadata export (inherit the generic
   root default) — lower priority than §4.5 since the homepage generic title is arguably correct
   brand copy already, and `/login` doesn't need unique SEO, but it should get an explicit
   `robots: noindex` since login/auth pages have no reason to be indexed. No file currently sets
   `noindex` anywhere in the app (`grep -rln "noindex|robots"` across `app` returned zero files).
3. `-preview` routes (§2.6) have no "this is a preview" banner distinguishing them from
   production surfaces for anyone who reaches them by direct URL.
4. `/quizzes` has no real student-facing quiz-taking UI reading real `quiz_attempts` (the schema
   and RLS are real and ready; only the UI is missing) — lower priority than §4.4 because unlike
   the three Student Portal pages, this isn't showing *fabricated* data, it's simply not built yet.

### Deferred (explicitly out of scope for this pass, not silently dropped)
- Wiring the entire legacy Admin Workspace (§2.5, ~40 routes) and Operations Center/Platform Admin
  (13 routes) to real Supabase data. This is a large, multi-module effort on its own (already
  flagged as such in the Teaching/Business/System/Academy Admin integration reports from prior
  passes) — §4.1's middleware fix reduces the *access* risk immediately without requiring this
  much larger data-wiring effort first.
- Resource Registry (14-table version) — explicitly not built per standing instruction and
  `docs/DATA_DICTIONARY_MAIN_AUDIT.md` §0/§6's own reasoning; nothing in this audit changes that
  conclusion.
- Unifying `approval_requests` vs `review_requests` (§5) — needs a human product decision on
  intended scope, not a schema fix.
- Full RLS re-audit of every table (out of scope for Phase 0; spot-checks only, consistent with
  every prior module's own report in this repo).

---

## 7. Chưa xác minh runtime (explicitly not claimed as verified)

Per the mandatory honesty requirement — **none of the following were tested against a live
environment in this pass**:
- Actual browser behavior at 360×800/390×844/430×932 (§4.3's finding is CSS-source-level, not a
  device screenshot).
- A real login → protected route → login → redirect-back round trip against a live Supabase
  project.
- Payment webhook retry against a real payment provider sandbox.
- RLS cross-user/cross-workspace denial tests executed against a live database.
- Signed URL expiry/denial behavior against real R2.
- Production build/deploy of any change described here — **no code was changed in this pass**.

This document does not claim any of the above passed; it claims only what direct source
inspection can support, with the file/line evidence quoted above.
