# H2O Coach OS V1 — Final Report

Date: 2026-08-14
Audit: `docs/h2o-coach-v1/01_PRODUCTION_AUDIT.md`
Migration: `supabase/migrations/0057_h2obook_h2o_coach_os_v1.sql` (applied to production by the user, verified by a real end-to-end script)

## What was built

A conversational Learning Companion layer on top of the existing Mission Workspace — a student talks
naturally with H2O Coach instead of filling 4 separate tabs, while every canonical Journey/progress/
evidence/completion mechanism stays exactly as it was.

- **5 new tables** (migration 0057), all additive: `coach_stage_profiles`/`coach_stage_profile_versions`
  (versioned per-Stage config, draft→publish→rollback, mirrors `learning_journey_blueprints`/`_versions`
  down to the same `current_published_version_id` pointer pattern), `coach_mission_configs` (per-Mission
  coaching rules/fields/tools), `learner_memory_values` (structured cross-Mission memory with
  provenance and confirm/reject), `coach_conversations` (bounded per-Mission message history).
- **Offline rule engine** (`lib/h2o-coach/offline-engine.ts`) — fully deterministic, zero AI required,
  unit tested (9 tests). This is real V1 value on its own: a Stage's Coach can run a complete
  question-and-confirm flow with no AI provider configured anywhere.
- **AI/Hybrid mode** (`lib/h2o-coach/provider-gateway.ts`) reuses H2O Brain's exact Gemini call
  convention (server-only fetch, JSON `responseSchema`, same `GEMINI_API_KEY`). Not configured in this
  deployment (local or Vercel production) — verified before writing any code — so it gracefully falls
  back to offline, same as every other Gemini-backed feature in this repo already does.
- **Student H2O Coach Workspace** (`components/h2o-coach/coach-workspace-shell.tsx`) — 3-column layout
  (Journey Context / Coach Conversation / Live Brain Memory), mounted inside the existing
  `/student/missions/[missionId]` route, reusing the Mission's real sibling list, resource bindings,
  and readiness score already loaded by `getMissionWorkspaceView` — no duplicate queries.
- **Admin H2O Coach Builder** (`app/academy-admin/coach-builder/page.tsx`, owner/admin only) — real
  Stage list, 6 tabs covering the source spec's 8 sections (Mission Coaching/Tools/Rules consolidated
  into one tab since they share one `coach_mission_configs` row per Mission in this schema), version
  history with duplicate/publish/rollback.
- **Learner memory confirmation protocol**: AI/offline never writes `confirmed` for a field marked
  `requiresConfirmation` — only the student's own explicit confirm action does
  (`POST /api/student/h2o-coach/memory`).

## Deliberate scope decisions (see audit §5 and code comments for full reasoning)

- Feature flag `NEXT_PUBLIC_H2O_COACH_WORKSPACE_V1` defaults **OFF** — the source spec's own rollout
  plan is "Phase 1: owner/admin only Builder, rollout 100% Stage 1 sau QA," i.e. an opt-in pilot an
  admin turns on after configuring and reviewing a real Coach profile, not a silent replacement of the
  4-tab workspace for every student on deploy.
- No teacher-facing memory-review UI beyond confirm/reject on the student's own values — out of scope
  this pass, same disciplined-scope pattern as prior folders this session.
- No cross-stage knowledge grounding (§7's optional 4th tier) — no admin toggle exists for it in this
  pass's config shape, so it is simply never enabled rather than half-implemented.
- No cron-scheduled anything — Coach turns are request-driven, matching every other real-time feature
  in this repo.

## Validation

- `pnpm typecheck` — clean.
- `pnpm lint` (scoped to changed files) — clean (fixed one duplicate-object-key error and two
  unescaped-quote JSX errors found during the pass).
- `pnpm test` — 230/230 passing (9 new, `tests/unit/h2o-coach.test.ts`, covering the offline rule
  engine's question ordering, missing-field detection, and "never marks completion itself" behavior).
  `lib/h2o-coach/service.ts`, `repository.ts`, `memory.ts`, `admin.ts` cannot be unit-tested directly
  (`server-only`), same limitation every prior folder this session hit — verified instead by a real
  end-to-end script against production (below).
- `pnpm test:sql` — passes (unrelated fixed-table checklist; migration 0057's own RLS is inline in the
  file and was separately verified live).
- `pnpm build` — clean, all new routes present in the build manifest.
- **Real production verification** (after the user applied the migration): created a Stage profile →
  draft v1 → Mission config → published v1 → duplicated to v2 → published v2 (archived v1) →
  **rolled back** by republishing archived v1 (archived v2) — the exact "Nhân bản → Draft → Áp dụng →
  rollback" flow the source spec requires. Inserted a proposed `learner_memory_values` row, confirmed
  it (status transition). Inserted a `coach_conversations` row. Confirmed a `coach_mission_configs`
  insert with a nonexistent `mission_id` correctly fails its foreign key (409). Deleted every test row;
  confirmed 0 remain across all 5 tables.
- **Regression check**: `career_stages` Stage 1 still `status:'active'`, `position:5` (unrelated to
  this migration, confirmed unchanged); `learning_journey_missions` count for the org still 58 rows.
  Migration 0057 makes zero changes to any Journey Core table — same tables checked after folder 38's
  migration, still intact.

## Deployed

- Merged `feature/h2o-coach-os-v1` → `main`, pushed.
- `vercel --prod` deployment `dpl_38uavYthAYEhA6PHtQdWfarJocvY`, aliased to `h2obook-app.vercel.app`.
- Live route check: every new route (`/api/student/h2o-coach/*`, `/api/academy-admin/coach-builder/*`,
  `/academy-admin/coach-builder`, `/student/missions/[missionId]`) returns the same `307 → /login` as
  the `/api/system/health` baseline for an unauthenticated request — wired into the normal auth
  pipeline, not erroring.

## What an admin needs to do to actually see this live

Nothing renders differently to students today: `NEXT_PUBLIC_H2O_COACH_WORKSPACE_V1` is unset (defaults
off) in this deployment, and even once turned on, a Stage only shows the Coach Workspace once an
admin has configured and **published** a Coach profile with at least one Mission's coaching config —
otherwise every Mission page falls back to the unchanged 4-tab Mission Workspace exactly as before.
