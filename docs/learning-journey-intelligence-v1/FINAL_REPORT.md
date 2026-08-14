# H2OBOOK Learning Journey Intelligence V1 — Final Report

Date: 2026-08-14
Audit: `docs/H2O_LEARNING_JOURNEY_AUDIT.md`
Migration: `supabase/migrations/0056_h2obook_learning_journey_intelligence_v1.sql` (applied to production 2026-08-14 by the user, verified by a real insert/read/constraint/cleanup script)

## What was built

A 90-day "Learning Memory" layer on top of the existing Journey Core (Stage → Mission → Checkpoint →
Progress → Unlock — untouched), feeding deterministic student-context data for an H2OBrain consumer
and Weekly/Day30/Day60/Day90 capability snapshots.

- **Daily Log**, backed by `learner_experiences` (migration 0026, generalized here — not a new table).
  New fields: `mission_id`, `journey_day`, `best_result`, `suspected_reason`, `self_score`,
  `instructor_score`, `practice_minutes`. Existing fields reused as-is: `steps_taken`, `challenges`,
  `next_improvement`, `asset_ids`, `instructor_feedback`.
- **Skill observation**: writes into the existing `learning_skill_evidence` table
  (`source_type='learner_experiences'`), tagged with the same 9-key skill vocabulary already shown in
  the Skill Passport (`lib/student/experience.ts`'s `studentSkills`) — not a second taxonomy.
- **H2OBrain student-context**: `GET /api/h2obrain/student-context` — deterministic aggregation only
  (averages, trend, recurring-reason counts), no AI call inside the endpoint. Any AI mentor consuming
  it interprets; it never regenerates the numbers.
- **Capability snapshots**: new table `learning_capability_snapshots` (Weekly/Day30/Day60/Day90),
  generated on demand via `POST /api/student/learning-journey/snapshot` (no cron infrastructure
  existed to hook into — `vercel.json` has no `crons` array). Honesty rule enforced in code: fewer
  than 3 real practice entries in the period → `hasEnoughEvidence:false` and summary text
  "Chưa đủ Evidence để đánh giá", never a fabricated score.
- **Daily Log UI**: `components/student/mission-workspace/daily-practice-logger.tsx` rewritten to the
  richer field set (skill tags, self-score slider, best result, problem, suspected reason, next
  action, practice minutes), now posting to `/api/student/learning-journey/log`.

## folder 36 compatibility

`lib/stage1-learning-os/daily-practice.ts` keeps its exact exported signatures
(`saveDailyPracticeEntry`, `listDailyPracticeEntries`, `DailyPracticeEntry`) but now reads/writes
`learner_experiences` instead of `learner_notes`. `app/api/student/practice/route.ts` is unchanged and
still works — confirmed live (307 → `/login`, same as every other protected API route, not a 404/500).
`learner_notes` itself is untouched: still serves the Reader's "Lưu vào Học & ghi nhớ" feature
(`lib/curriculum/reader-context.ts`, `app/api/learning/notes/route.ts`), unrelated to this change.

No backfill was needed: `learner_notes` had zero real rows with `resource_type='mission'`, and
`learner_experiences` had zero real rows of any kind — both verified by direct production query
before the migration was written.

## Validation

- `pnpm typecheck` — clean.
- `pnpm lint` (scoped to changed files) — clean.
- `pnpm test` — 221/221 passing (14 new, `tests/unit/learning-journey.test.ts`), covering `average`/
  `trend`/`journeyDayFromDate`/`summarizeRecurringReasons`/`periodBounds`/`hasEnoughEvidence` and the
  skill-taxonomy helpers. `lib/learning-journey/service.ts`, `student-context.ts`, `snapshots.ts`
  cannot be unit-tested directly (`server-only`), same limitation every prior folder this session hit
  — verified instead by a real end-to-end script against production (see below).
- `pnpm test:sql` — passes (unrelated fixed-table checklist; migration 0056's own RLS is inline in the
  file and was separately verified live).
- `pnpm build` — clean, no errors.
- **Real production verification** (insert → upsert-on-conflict → read-back → constraint-violation →
  delete → confirm 0 rows remain), run after the user applied the migration:
  - Inserted a `learner_experiences` row with every new V1 column populated — succeeded, read back
    correctly.
  - Upserted a `learning_skill_evidence` row twice (same conflict key) to prove the admin-client path
    correctly handles the `ON CONFLICT UPDATE` branch that a student's own session cannot (no
    self-update RLS policy on that table) — both passes succeeded, score updated 72→73 on the second.
  - Inserted a `learning_capability_snapshots` row with nested `jsonb` skill scores — succeeded.
  - Attempted to insert a `learner_experiences` row with neither `knowledge_space_id` nor `mission_id`
    set — correctly rejected with `learner_experiences_has_a_subject` constraint violation (23514).
  - Deleted all test rows; confirmed 0 remain in all three tables.
- **Regression check**: `career_stages` id `37d7584f-...` (Stage 1) still `status:'active'`
  (unaffected by this migration); `learning_journey_missions` count for the org unchanged at 58 rows.
  Migration 0056 makes zero changes to any Journey Core table (`career_stages`,
  `learning_journey_blueprints`, `outcomes`, `milestones`, `learning_journey_missions`, `actions`,
  `student_mission_states`).

## Deployed

- Merged `feature/learning-journey-intelligence-v1` → `main`, pushed.
- `vercel --prod` deployment `dpl_9yvd8qoSoLrcCU8gf8CNGHGwkjoh`, aliased to `h2obook-app.vercel.app`.
- Live route check: `/api/student/learning-journey/log`, `/api/h2obrain/student-context`,
  `/api/student/learning-journey/snapshot`, and the unchanged `/api/student/practice` all return the
  same `307 → /login` as the pre-existing `/api/system/health` baseline for an unauthenticated
  request — routes exist and are wired into the normal auth pipeline, not erroring.

## Feature flags (env-var pattern, matches every prior folder — no DB-backed flag table)

- `NEXT_PUBLIC_LEARNING_JOURNEY_LOG_V1` (default on) — reserved for gating the richer Daily Log UI if
  ever needed; the UI currently mounts under the existing `stage1LearningOsFeatures.dailyPractice`
  gate already in `mission-workspace-client.tsx` (unchanged).
  `NEXT_PUBLIC_LEARNING_CAPABILITY_SNAPSHOTS_V1` (default on) — reserved for the snapshot API/UI.
- `NEXT_PUBLIC_LEARNING_EVIDENCE_COMPLETION_GATE` (default **off**) — a Mission cannot yet require a
  Daily Log entry before completion; turning this on is a product decision, not made here.

## Known limitations / explicitly out of scope this pass

- No teacher-facing review UI for `instructor_score`/`instructor_feedback` — the service function
  (`recordInstructorReview` in `lib/learning-journey/service.ts`) and the DB columns exist and are
  ready, but no admin screen calls it yet.
- No dedicated cross-Mission "90-day timeline" page. The Daily Log's own entry list (inside each
  Mission's workspace) is a real reverse-chronological history already; a page aggregating every
  Mission's entries into one timeline was judged separate, unscoped work and not built.
- No cron-scheduled snapshot generation — `POST /api/student/learning-journey/snapshot` is on-demand
  only, since no scheduler infrastructure exists in this repo to hook into.
- The Daily Log skill picker reuses the existing 9-key vocabulary (`skin`/`face`/`bridal`/`waves`/
  `updo`/`consult`/`team`/`pricing`/`brand`), not the reference package's 22-code taxonomy — a
  deliberate reuse decision (see audit doc §3), not an oversight.
