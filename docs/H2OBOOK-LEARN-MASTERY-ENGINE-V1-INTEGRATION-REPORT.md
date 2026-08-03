# H2OBOOK Learn Mastery Engine V1 — Integration Report

Branch: `feat/learn-mastery-engine-v1`
Source module: `v5/11-h2obook-learn-mastery-engine-v1`
Status: **READY_FOR_VERCEL_PREVIEW**

This pass was explicitly asked to also check logical consistency against the rest of the already-integrated stack (modules 8/9/10), not just add new code. §1 documents what that check found and fixed.

## 1. Audit summary + consistency findings

- The top-level `/learn` route in this repo is the pre-existing **workspace/creator** "Smart Learning" page (`app/learn/page.tsx`, goals/flashcards, `AppShell`) — unrelated to students. It is **not** the route this module's role-aware split assumes. Per the same adapter pattern used in modules 8–10, the new learner Learning Command Center lives under `/student/*`, and `/learn` is untouched.
- **`/student` (Smart Home, from module 9) already implements most of "Hành trình của tôi"** (today's mission, mastery score, current stage, skill map preview, achievements) — so instead of building a duplicate journey page, this pass wired *real* data into the sections that were still static, rather than creating a new route.
- **Found and fixed a real bug from the module 10 report**: it claimed "6 recipes ported" — the actual count was 5. Corrected in `docs/H2OBOOK-CREATE-OUTCOME-STUDIO-V1-INTEGRATION-REPORT.md`.
- **Found and fixed a real slug mismatch**: module 11's `DEFAULT_LEARN_CREATE_MAPPINGS` references recipe slugs (`personal-makeup-kit-checklist`, `face-analysis-workbook`, `foundation-before-after-casebook`, `makeup-artist-brand-kit`, `90-day-content-plan`, `wedding-sales-script-vault`) that did not match module 10's actual slugs (`kit-checklist`, `practice-casebook`, and 3 recipes that had been dropped entirely). Fixed by renaming 2 slugs and adding the 3 missing recipes to `lib/student/create-outcome.ts` (now 9 recipes total) — grepped the whole repo first to confirm nothing else referenced the old slugs before renaming.
- **Verified (did not need to fix) that the skill-key vocabulary is genuinely consistent end to end**: `lib/academy/catalog.ts`'s `skillKeyForModule()` (which tags real seeded lessons) emits exactly `face/skin/waves/updo/consult/team/pricing/brand/bridal`, which is exactly `lib/student/experience.ts`'s `studentSkills` id list. This means `academy_skill_progress.skill_key` rows are safe to merge directly with the new `learning_skill_evidence.skill_key` rows in `getSkillMastery()` — same vocabulary, not two incompatible tag systems.
- Confirmed `public.learning_results` already exists (module 8, 0026) — the reference module's `h2o_learn_results` table was **not** duplicated; broadening it to non-Knowledge-Space result sources is deferred (§5).
- Confirmed `public.flashcards` (0006) has no skill-key column — it is used for the "due cards" signal in the Today Plan and the "Học & ghi nhớ" review widget, but is **not** wired into skill mastery evidence (a real gap, not fabricated — see §5).

## 2. Files added/changed

**Database**
- `supabase/migrations/0028_h2obook_learn_mastery_engine_v1.sql` — one new table, `learning_skill_evidence` (evidence ledger for `review`/`quiz`/`practice`/`instructor`/`create` kinds), RLS (self read/insert + staff read), and one additive column: `create_outcome_projects.skill_keys text[]`. See the migration's header comment for the full reasoning on why 4 of the reference module's 5 proposed tables were deliberately *not* created (skill catalog, daily tasks, results, create-bridges — all already covered by existing tables or static app data). Checked against 0001–0027 for name collisions before committing.

**Server logic**
- `lib/student/mastery.ts` — ported `calculateSkillMastery`/`calculateOverallMastery` (pure), plus `getSkillMastery(userId, organizationId)` which merges `academy_skill_progress` (existing "lesson" signal) with `learning_skill_evidence` (new ledger) per skill.
- `lib/student/planner.ts` — ported `rankLearningTasks`/`buildTodayPlan` (pure), plus `buildTodayPlanForUser()` which assembles real tasks from due flashcards and in-progress `create_outcome_projects` — no persisted task queue, no fabricated data.
- `lib/student/learn-to-create.ts` — the 6 Learn→Create trigger mappings, reusing `create-outcome.ts`'s `resolveRecipe()` directly (one access model, not two).
- `lib/student/outcome-access.ts` (new, extracted) — `loadOutcomeAccessContext()`, shared by `/student/create` and `/student/learn` so "unlocked" means the same thing in both places.
- `lib/student/create-outcome.ts` — recipe catalog fixed/expanded per §1; added `skillKeys` to `OutcomeRecipe`.
- `app/api/student/summary/route.ts` — now also returns `skillMastery`/`todayTasks` (empty arrays, not fake data, when Supabase/org aren't configured).
- `app/api/create/projects/route.ts` — now stores `skill_keys` from the recipe on project creation.
- `app/api/create/projects/[id]/share/route.ts` — on a successful share, writes one `learning_skill_evidence` row per tagged skill (`evidence_kind: "create"`), best-effort, never blocking the share response.

**UI**
- `app/student/learn/page.tsx` (new) — "Học & ghi nhớ": current lesson, due flashcards, recent Knowledge Space notes, in-progress Knowledge Spaces, Learn→Create suggestions (locked/unlocked, reusing the shared access context), Ask Instructor CTA.
- `app/student/page.tsx` — the "NHIỆM VỤ HÔM NAY" and "SKILL MAP" sections now render `live.todayTasks`/`live.skillMastery` when available (production mode with real data), falling back to the existing static demo content otherwise — same fallback pattern already used elsewhere on this page.
- `lib/student/compact-navigation.ts` / `components/student/student-shell.tsx` — LEARN group is now 4 items (Hành trình của tôi / Học & ghi nhớ / Thư viện của tôi / Thực hành & kết quả) instead of 3, per the module's target IA. Destinations: `/student/courses`, `/student/learn` (new), `/student/library`, `/student/assignments` — no existing route was renamed or removed.

## 3. Security implementation

- `learning_skill_evidence`: no direct learner INSERT policy from the client is *needed* — the only writer in this pass is the share API route, which inserts using the user-scoped RLS client with `user_id: auth.user!.id` matching the session, so RLS's `with check (user_id = auth.uid())` is satisfied by construction; a forged `user_id` would simply fail that check.
- `getSkillMastery`/`buildTodayPlanForUser` run server-side only (`import "server-only"`) using the admin client, scoped to the requesting user's own `userId` — never client-supplied.
- Learn→Create unlock state is resolved once (`loadOutcomeAccessContext`) and reused identically wherever a recipe link is shown — no duplicated, potentially-divergent access logic.

## 4. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 0 new warnings |
| `pnpm test` (vitest) | ✅ 21 files / 69 tests passed, no regressions |
| `pnpm test:sql` | ✅ passed |
| `pnpm validate:migrations` | ✅ 28 sequential migrations |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; `/student/learn` and all other routes present |

Not executed: live multi-role click-through, Playwright E2E (no browser in this session).

## 5. Risks / TODO (explicitly deferred)

- **Flashcards are not skill-tagged.** They power the "due cards" signal in the Today Plan and the review widget, but do not (yet) contribute `review`-kind evidence to skill mastery — `public.flashcards` has no `skill_key` column. Adding one (and updating `review_flashcard()` from 0006 to write evidence) is the natural next step.
- **No quiz/instructor evidence sources exist yet** in this repo (quiz-taking and assignment grading are themselves deferred from module 8's report) — `learning_skill_evidence` supports those `evidence_kind` values for when they land, but nothing writes them today.
- **`public.learning_results` was not broadened** to accept quiz/assignment/stage-sourced results (only Knowledge-Space-sourced ones exist today) — the reference module's generic `h2o_learn_results` was intentionally not built to avoid a near-duplicate table; this is deferred, not silently dropped.
- **Learn→Create trigger detection is manual, not automatic**: the 6 mappings in `lib/student/learn-to-create.ts` are shown as a curated list on `/student/learn`, not auto-triggered from a specific lesson a student is viewing (lessons don't carry a `result_recipe_slug` metadata field yet). The Knowledge Space player's existing "Tạo kết quả từ bài học này" CTA (module 10) remains the primary, fully-automatic Learn→Create bridge.
- **No new unit tests were added** for `mastery.ts`/`planner.ts` (the ported pure functions are unit-tested in the source module's own `tests/core.test.mjs`, not re-ported here) — existing 69 tests still pass unmodified.
- **Admin/Instructor Learn analytics views were not touched** — this pass only adds the learner side; the module's own §9 (Admin/Instructor permission enforcement) already holds because nothing here grants students access to any admin/instructor route or data.

## 6. Safe merge steps

Same as modules 8/9/10: get product-owner confirmation on a Vercel Preview before merging to `main` — but per this session's standing instruction, this branch is merged and deployed immediately after this report. Rollback is a plain revert; every DB change here is additive (one new table, one new column).
