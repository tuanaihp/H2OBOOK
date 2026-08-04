# H2OBOOK — Student Self-Signup & Real Career-Stage Lock — Integration Report

Branch: `feature/student-self-signup-stage-lock`
Trigger: user-reported live bug — a newly registered account landed in the full Owner admin
interface instead of a tiered student space.

## 1. Root cause (confirmed from source)

- `/signup`, linked from **both** login variants' "Chưa có tài khoản?", called
  `supabase.auth.signUp({..., options: { data: { role: "owner" } } })` — every self-registration
  explicitly requested the Owner role.
- `handle_new_user()` (migration 0024, the currently-active version of the trigger fired on every
  new `auth.users` row): `if coalesce(new.raw_user_meta_data->>'role','owner')='owner' and not
  exists(...organization_members...) then` — creates a **brand-new organization** and inserts the
  new user as its `owner`. This branch fires whenever role is `'owner'` *or absent* (the
  `coalesce` default is also `'owner'`).
- Net effect: anyone clicking "Chưa có tài khoản?" on the public academy's own login page got a
  fresh, empty, but fully-privileged Owner workspace — never joined Thủy H2O's real academy as a
  student, never went through any tier/level gate.
- The **real, correct, invite-based student path already existed and was unaffected**:
  `academy_applications` → admin approves/invites → `ensureStudentAuthUser()` (explicitly passes
  `role: "student"` in the invite metadata, so the owner-workspace branch never fires for it) →
  `/auth/accept-invite` → `/student`. This report does not touch that path.

## 2. Fix — Part A: self-service student registration

- `components/marketing/signup-form.tsx`: `role` metadata changed from `"owner"` to `"student"`
  (this alone stops the owner-workspace-creation branch from firing), copy changed to "Tạo tài
  khoản học viên", and after `signUp()` succeeds it calls the new `/api/auth/register-student`.
- New `lib/academy/service.ts:joinAcademyAsStudent()` — joins the *already-authenticated* caller
  to the real, server-configured academy organization (`configuredAcademyOrganizationId()`, same
  resolver every other academy code path uses) with `role: 'student'`. Idempotent
  (`ignoreDuplicates: true` on the `organization_members` upsert) — a retry can never duplicate a
  row or downgrade an existing, different role back to student.
- New `app/api/auth/register-student/route.ts` — requires a real session
  (`requireApiUser`); role and target organization are **never accepted from the client**, always
  hardcoded server-side. Runs through the service-role admin client because a brand-new user has
  no RLS grant to insert their own `organization_members` row (by design — only admin/owner can
  write that table; see `docs/H2OBOOK_PRODUCTION_GAP_AUDIT.md`'s domain matrix).
- **Safety net for the email-confirmation-required case**: if a Supabase project requires email
  confirmation, the register-student call at signup time has no session yet to authenticate with.
  Both login forms now also call `/api/auth/register-student` right after a successful sign-in,
  but only when the resolved session role is `"student"` — `getCurrentUser()` already defaults to
  `role: "student"` for any session with no real `organization_members` row (a pre-existing,
  already-safe fallback), so this call only ever fires for genuine students or that exact limbo
  case, never for an existing admin/teacher/owner account.
- `/signup`'s previous "create a brand-new workspace as Owner" behavior no longer has a public
  entry point. No other in-app link pointed to it besides the two login forms' "Chưa có tài
  khoản?" (confirmed by grep). If a legitimate "start your own separate H2OBOOK workspace" flow is
  ever needed again, it needs its own deliberate, non-public provisioning path — not this one.

## 3. Fix — Part B: real per-student career-stage lock

- **Before**: `studentCareerStages` (`lib/student/experience.ts`, 5 stages: foundation → practice
  → first-client → professional → leader) had a hardcoded `status` field, identical for every
  user (foundation always "completed", practice always "active", the rest always "locked") —
  regardless of who was actually logged in.
- **After**: new `lib/student/stage-access.ts:getUnlockedStageIds()` computes real, per-student
  unlock state:
  - The first stage (free knowledge) is always unlocked for any real student.
  - Every other stage unlocks with a real active `memberships` row (the same source-of-truth
    table the whole commerce/entitlement flow already uses — no new commerce concept invented).
  - Individual stages can also be unlocked one at a time via a manual grant, reusing
    `business_feature_grants` (module 13's text-keyed grant table — `source_type='manual_grant'`,
    `feature_slug` = the stage id) rather than creating a parallel table for this.
  - No new migration: both tables already exist with the right shape and RLS.
- Wired into **both** places stages are shown:
  - `app/student/roadmap/page.tsx` (already a real server component) — stage status is now
    `unlockedStageIds.has(stage.id) ? "active" : "locked"` instead of the hardcoded field. Locked
    stages now show "Đăng ký nâng cấp" linking to `/academy/membership` (the existing real
    membership/enrollment page) instead of the old "Hoàn thiện điều kiện" action.
  - `components/student/smart-home-roadmap-widget.tsx` (Smart Home) — now accepts a real
    `unlockedStageIds` prop from `/api/student/summary` (extended to return it, same pattern
    already used for `skillMastery`/`todayTasks`) instead of importing the static array's status
    directly. Locked milestones link to `/academy/membership` instead of `/student/roadmap`.
- A fabricated "completed" status was deliberately **not** kept — the previous code marked
  "foundation" as permanently completed for everyone, which was never true for any real user
  (there is no real per-requirement completion tracking yet). Stages now render as either
  `active` (unlocked) or `locked` (not yet), which is what the underlying data can actually
  support honestly.

## 4. Files changed

**New**: `lib/student/stage-access.ts`, `app/api/auth/register-student/route.ts`.
**Modified**: `components/marketing/signup-form.tsx`,
`components/public-academy-v5/public-login-experience.tsx`,
`components/marketing/legacy-login-form.tsx`, `lib/academy/service.ts`,
`app/student/roadmap/page.tsx`, `app/api/student/summary/route.ts`,
`components/student/smart-home-roadmap-widget.tsx`, `app/student/page.tsx`.

No migration. No table created. No existing route deleted.

## 5. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 51 pre-existing warnings, none new |
| `pnpm test` (vitest) | ✅ 22 files / 72 tests passed, no regressions |
| `pnpm test:sql` | ✅ passed |
| `pnpm validate:migrations` | ✅ 31 sequential migrations (unchanged) |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; `/signup`, `/student`, `/student/roadmap`, `/api/auth/register-student` all present |

Not executed: an actual live signup → Supabase → login round trip (no live environment access in
this session). The fix is verified at the source/type level and by re-reading the exact trigger
SQL that determines the outcome, not by a browser test.

## 6. Risks / what remains

- **Existing accounts that already self-registered as Owner through the old `/signup` are not
  retroactively fixed by this change.** This is a forward-looking fix only — it stops new
  incorrect signups. If any real prospective-student accounts already got created as unintended
  Owners of their own empty workspaces, those need to be found and reconciled by hand (e.g. list
  `organizations` created after the site's real launch date with a single-member `owner` and no
  real content) — out of scope for this pass since it requires querying live production data, not
  something this session can safely do without direct database access and explicit confirmation.
- **The "Đăng ký nâng cấp" button leads to the existing academy membership/enrollment intake
  form** (`/academy/membership`, which feeds the real `academy_applications` → admin-approval
  pipeline), not an instant self-checkout that unlocks a stage automatically. Building a real
  product→stage→payment→automatic-unlock pipeline (so a purchase immediately flips a stage from
  locked to unlocked without an admin step) is a larger, separate piece of work not requested in
  this exact fix and not built here.
- **No admin UI exists yet to grant/revoke a specific stage manually** — the `business_feature_grants`
  read path this pass added is real and wired, but nothing writes a `source_type='manual_grant'`
  stage row yet. An admin can only unlock a student's stages today by giving them an active
  `memberships` row (which unlocks all stages at once), not stage-by-stage. Adding a small
  extension to `/academy-admin/distribution` for stage-specific manual grants is a reasonable
  next step but wasn't requested as part of this exact bug fix.

## 7. Rollback

- Revert the merge commit, or `git revert` this branch's commit range.
- No migration to roll back — reverting the code alone is sufficient.
