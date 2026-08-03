# H2OBOOK Teaching Intelligence Center V1 — Integration Report

Branch: `feature/teaching-intelligence-center-v1`
Source module: `v5/12-h2obook-teaching-intelligence-center-v1`
Status: **READY_FOR_VERCEL_PREVIEW**

Requested with the same instruction as prior passes: check logical consistency against the whole existing webapp, not just add new code in isolation. §1 documents what that audit found.

## 1. Audit summary + consistency findings

- **The source module models 6 roles (mentor/instructor/reviewer/training_manager/admin/owner) backed by a dedicated `teach_role_assignments` table. This repo's real role system (`public.member_role`, migration 0001) only has `owner/admin/designer/partner/teacher/student`.** There is no DB-backed mentor/reviewer/training_manager distinction anywhere in the app — `lib/student/compact-navigation.ts`'s `toAccountRole()` already anticipated a `"reviewer"` `AccountRole` but has no branch that ever produces it from a real DB role; it is currently dead code. Introducing a parallel role table just for this module would create a second identity system to keep in sync with `organization_members` forever. Instead, `TeachingRole` (`lib/teaching/types.ts`) is narrowed to `teacher | admin | owner` — exactly what the database can attest today. Mentor/reviewer/training_manager stay a documented future extension (§5).
- **Scope model reuses what already exists**: `public.classes.teacher_id` and `public.class_members` (both migration 0002) already express "which classes/students does this teacher own" — so no `teach_scope_assignments` table was created either. `lib/teaching/access.ts`'s `getTeachingAccessSnapshot()` derives `assignedClassIds`/`assignedStudentIds` from those two tables directly.
- **Grading already has real tables** — `public.assignment_submissions` (0002, legacy classroom assignments) and `public.brain_assignment_submissions` (0026, Knowledge Space assignments) both already carry `score`/`feedback`/`status`/`graded_by`/`graded_at`. A `teach_feedback_events` audit table would just duplicate that. The one real gap was expressing a *portfolio-ready* decision (distinct from a normal pass) on `brain_assignment_submissions` — closed with one additive `portfolio_ready boolean` column instead.
- **`components/operations/instructor-dashboard.tsx` was 100% demo data** — it read from the client-side Zustand `useOperationsStore()` (`instructorClasses`, `assessmentTasks`), not Supabase. All three routes that rendered it (`/instructor`, `/instructor/classes`, `/instructor/students`, `/instructor/assessments`) were literally the same placeholder component with a different URL. All four were rewritten with real, distinct, Supabase-backed pages; the now-unreferenced demo component was deleted (confirmed via repo-wide grep that nothing else imported it).
- **Pre-existing RLS gap found, not introduced by this module**: migration 0002/0026's policies grant `assignment_submissions`/`brain_assignment_submissions`/`classes`/`assignments` read (and submission grading) to *any* org member with role `owner`/`admin`/`teacher` — not scoped to "teacher of this specific class." Module 10's own migration comment (0027) already flagged the same pattern as a known, deferred gap for `create_outcome_projects`. Rewriting that legacy RLS is out of scope for this pass (high blast radius across the whole existing Assignments feature). Instead, every new `/api/teaching/*` route enforces its own narrower scope in application code (`canAccessStudent`/`canAccessClass` in `lib/teaching/access.ts`) on top of whatever the legacy RLS already allows — documented as a real, not-hidden gap in §5.
- **One RLS gap this module *does* close**: `create_outcome_projects` (0027) had no staff UPDATE policy at all — only the owning student could update their own project, and 0027's own comment already called out "full per-class scoping is listed as deferred." Migration 0029 adds a real, class-scoped UPDATE policy (`c.teacher_id = auth.uid()`) so Feedback Studio's portfolio review action is enforced at the database layer, not just in application code.
- Confirmed `lib/student/compact-navigation.ts`'s existing `instructorGroups()` (module 9) already points its TEACH group at `/instructor/classes`, `/instructor/assessments`, `/instructor/students` — so this module upgrades the destinations of an already-wired nav instead of introducing a new `/teach/*` namespace. `instructorRoutes` (`lib/operations/routes.ts`) also already lists exactly these routes plus `/instructor/brain-studio` (module 8) — left untouched.
- Confirmed the middleware (`middleware.ts`) already redirects any `role === "student"` session away from every non-`/student` route, including `/instructor/*` — so "students and Membership never see Teach" (verification matrix items 1–2) was already true before this module and did not need new middleware code.
- `/students`, `/class-view`, `/reviews`, `/collaboration`, `/automations`, `/processing` were not touched at all — no risk of breaking them, no aliases needed.

## 2. Files added/changed

**Database** (`supabase/migrations/0029_h2obook_teaching_intelligence_center_v1.sql`)
- `public.brain_assignment_submissions.portfolio_ready boolean not null default false` (additive column).
- `public.teach_student_interventions` — the one genuinely new concept with no existing home: a private instructor note / action log tied to an at-risk student ("Risk Radar" intervention). RLS: teacher/student/org-admin read; only the class's own `teacher_id` (or admin/owner) can insert as themself.
- One new UPDATE policy on `public.create_outcome_projects`, class-teacher-scoped (see §1).
- Grepped every new identifier against migrations 0001–0028 before finalizing — no collisions.

**Server logic (`lib/teaching/*`, all new)**
- `types.ts` — narrowed `TeachingRole`, `TeachingAccessSnapshot`, risk/task/feedback types (ported from the source module's `src/core/types.ts`, with `class_session`/`content_review`/`reply_question` task kinds dropped — no session-schedule or content-review-assignment table exists yet, see §5).
- `risk.ts`, `tasks.ts`, `feedback.ts` — pure scoring/ranking functions ported as-is from `src/core/{risk,tasks,feedback}.ts`.
- `access.ts` — `getTeachingAccessSnapshot()` (real role/scope resolution), `canAccessStudent()`/`canAccessClass()` (the single enforcement point every per-student/per-class lookup calls first).
- `request.ts` — `resolveTeachingAccess()`, the shared entry point every `/api/teaching/*` route uses to verify session + real org role before touching any data.
- `students.ts` — `getAssignedStudentSummaries()` (per-student signals from `academy_lesson_progress`, `knowledge_space_progress`, `getSkillMastery()` reused from module 11, `assignment_submissions`, `brain_assignment_submissions`) feeding `assessStudentRisk()`; `getStudentInterventions()`.
- `classes.ts` — `getTeachingClasses()`, real class list with member count and average progress from `knowledge_space_progress`.
- `command-center.ts` — `buildTeachingCommandCenter()`, deterministic aggregation (submissions waiting for feedback, at-risk students, portfolio reviews pending, recent approved/published Create Outcome projects) ranked via `rankTeachingTasks()`.
- `submissions.ts` — `getSubmissionQueue()`, the unified Feedback Studio queue merging legacy + Brain Studio submissions.
- `grading.ts` — `gradeBrainSubmission()` (portfolio-ready always downgraded to "passed" unless the caller explicitly sets `confirmPortfolioReady`), `gradeLegacySubmission()`, `reviewOutcomeProject()`.
- `interventions.ts` — `createIntervention()`, `completeIntervention()`.
- `projects.ts` — `getPendingPortfolioProjects()`.

**API routes (`app/api/teaching/*`, all new)**
`command-center`, `classes`, `students`, `students/[id]`, `interventions`, `interventions/[id]/complete`, `submissions`, `submissions/brain/[id]/grade`, `submissions/legacy/[id]/grade`, `projects`, `projects/[id]/review`.

**UI**
- `app/instructor/page.tsx` — real Teaching Command Center (ranked task list, class/student/at-risk counts, recent achievements).
- `app/instructor/students/page.tsx` — Student Success Center: assigned-student list sorted by risk score, per-student risk detail + recommended actions, intervention create/complete.
- `app/instructor/classes/page.tsx` — Class Command Center: real class list with member count, average progress bar, at-risk count.
- `app/instructor/assessments/page.tsx` — Feedback Studio: unified submission queue (legacy + Brain Studio) with a grading panel (score, written feedback, skill-evidence picker reusing `studentSkills` from module 10/11, explicit portfolio-ready confirmation checkbox), plus a Portfolio review tab for pending Create Outcome projects (approve / request revision).
- `components/operations/instructor-dashboard.tsx` — deleted (dead code, see §1).

## 3. Security implementation

- Every `/api/teaching/*` route calls `resolveTeachingAccess()` first, which verifies the session (`requireApiUser`), resolves real organization membership + role (`resolveOrganizationAccess`, never trusted from the client), and only then builds `TeachingAccessSnapshot`. No route ever reads role/scope from a query param, header or request body.
- `app/api/teaching/students/[id]/route.ts` returns the same 404 for "student exists but not assigned to me" and "student does not exist" — an instructor cannot distinguish enumeration attempts from genuine 404s.
- `gradeBrainSubmission`/`gradeLegacySubmission`/`reviewOutcomeProject` all re-check `canAccessStudent()` against the submission's/project's actual owner before writing, independent of what the broader legacy RLS would otherwise allow (§1).
- Portfolio-ready is never auto-finalized: `evaluateFeedbackReadiness()` can only *suggest* `"portfolio_ready"`; `gradeBrainSubmission()` downgrades it to `"passed"` unless the request explicitly sets `confirmPortfolioReady: true`, which the UI only sends when the instructor has ticked a dedicated confirmation checkbox.
- `teach_student_interventions` RLS: insert only as `teacher_user_id = auth.uid()` and only for a real `teacher`/`admin`/`owner`; read limited to the owning teacher, the student themself, or org admin/owner.
- `create_outcome_projects`'s new UPDATE policy is scoped to the project owner's actual class teacher (`class_members` ⋈ `classes.teacher_id = auth.uid()`), not "any teacher in the org."

## 4. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors (1 pre-existing-pattern error introduced then fixed during this pass: `prefer-const` in `lib/teaching/students.ts`), 50 pre-existing warnings unrelated to this module |
| `pnpm test` (vitest) | ✅ 21 files / 69 tests passed, no regressions |
| `pnpm test:sql` | ✅ passed (static RLS-presence check; unaffected — checks a fixed table allowlist that doesn't include the new table) |
| `pnpm validate:migrations` | ✅ 29 sequential migrations |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; all `/api/teaching/*` routes and updated `/instructor/*` pages present in the route manifest |

Not executed: live multi-role click-through, Playwright E2E role matrix (no browser in this session) — see §5.

## 5. Risks / TODO (explicitly deferred, not silently dropped)

- **Mentor / Reviewer / Training Manager roles have no database backing.** `TeachingRole` only supports `teacher/admin/owner` today. Adding the other three roles for real would need either extending `public.member_role` (a breaking enum change touching every existing RLS policy that references it) or a genuinely separate grant table — a deliberate follow-up, not something to bolt on inside this pass.
- **Legacy RLS on `classes`/`assignments`/`assignment_submissions`/`brain_assignment_submissions` is broader than this module's scope model** (any org `teacher` role, not just the class's own teacher — see §1). This module's own API layer enforces the tighter scope; the underlying RLS was left alone because rewriting it touches the pre-existing Assignments feature end to end and needs its own regression pass.
- **Content & Approval (§G of the prompt) was not built as a new surface.** No `teach_content_review_assignments` table, no new UI — the existing `/reviews` + `review_requests` engine (migration 0003) is the reused engine per the prompt's own instruction, and this pass did not add a Knowledge-Space/lesson/quiz adapter on top of it. `/reviews` itself is untouched.
- **`teach_feedback_templates` (reusable feedback snippets) and `teach_rule_preferences` (per-teacher automation toggles) were not built.** Neither has a real consumer yet in this pass; adding them now would be speculative schema.
- **Class Command Center's Skill View / Assignment View / Risk View are not separate tabs** — `/instructor/classes` currently shows one aggregated Progress + Risk view per class. Bulk actions (notify, assign review, schedule support, create practice group) are not implemented.
- **No session-schedule table exists**, so "upcoming class sessions" and the `class_session` task kind from the source module were dropped entirely rather than fabricated (`lib/teaching/tasks.ts` header comment).
- **"Unanswered learner questions" was not implemented** — no Q&A/ask-instructor table exists in this repo yet to aggregate from.
- **Feedback Studio's rubric scoring is a single synthetic "overall" criterion**, not real per-criterion breakdown from `public.rubric_criteria` — `assignment_definitions.rubric_id` is often unset in practice (module 8's own report already flagged the grading UI as schema-only), so wiring true multi-criterion rubric scoring is deferred until real rubrics exist to score against.
- **Voice/annotation feedback adapters were not implemented** — text feedback only.
- No Playwright E2E role matrix was run in this session (no browser available); the 7-identity verification matrix from the prompt should be exercised manually or in CI before wider rollout.

## 6. Rollback

- Revert the merge commit on `main`, or `git revert` this module's commit range.
- Database: migration 0029 is purely additive (one new table, one new column, two new policies) — no destructive rollback SQL is required to restore prior behavior; simply do not run it on an environment that should stay on module 11's schema. If it was already applied, the app degrades gracefully because nothing in modules 1–11 reads `portfolio_ready` or `teach_student_interventions`.
