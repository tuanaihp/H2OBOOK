-- H2OBOOK Learn Mastery Engine V1 (adapter migration)
-- Source module: v5/11-h2obook-learn-mastery-engine-v1. Reference schema is
-- supabase/20260803_learn_mastery_engine_v1.sql from that module; NOT applied as-is.
--
-- Audit findings that shaped this migration's (deliberately lean) scope:
--   - Skill CATALOG already exists as static app data (lib/student/experience.ts's
--     studentSkills), matching the repo's existing convention (academy catalog, module 10
--     recipes) — no h2o_learn_skill_definitions table is created.
--   - "lesson" evidence already exists as public.academy_skill_progress (0024) — a
--     pre-aggregated skill_key -> progress_percent/evidence_count per user. This migration
--     does NOT duplicate it with per-lesson evidence rows; lib/student/mastery.ts merges it
--     in at read time as a synthetic evidence entry instead.
--   - "practice"/"create" evidence needs a source: public.create_outcome_projects (0027) had
--     no skill tagging, so this migration ALTERs it (additive column) rather than introducing
--     a parallel project table, per the module's own "extend existing entity" preference.
--   - "review"/"quiz"/"instructor" evidence kinds are supported by the table below so future
--     subsystems (flashcard skill-tagging, quiz grading, instructor review) can write into it,
--     but no existing subsystem produces them yet — writing those is deferred, not faked.
--   - h2o_learn_daily_tasks (reference schema) is NOT created: "Today Plan" is computed live
--     from real tables (incomplete lessons, due flashcards, in-progress outcome projects) on
--     every page load via lib/student/planner.ts, which matches the module's own rule
--     ("Không tạo dữ liệu giả ở production. Task phải có provenance và deep link thật") more
--     directly than a persisted, potentially-stale task queue would.
--   - h2o_learn_results (reference schema) is NOT created: public.learning_results already
--     exists (0026) for Knowledge-Space-sourced results; broadening it to cover
--     quiz/assignment-sourced results too is listed as deferred in the integration report
--     rather than shipping a near-duplicate table.
--   - h2o_learn_create_bridges (reference schema) is NOT created: the trigger->recipe mapping
--     is static app data (lib/student/learn-to-create.ts), matching how module 10's recipe
--     catalog itself is static.
begin;

create table public.learning_skill_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_key text not null,
  evidence_kind text not null check (evidence_kind in ('lesson','review','quiz','practice','instructor','create')),
  source_type text not null,
  source_id uuid,
  score numeric(5,2) not null check (score between 0 and 100),
  weight numeric(5,4),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, skill_key, evidence_kind, source_type, source_id)
);
create index learning_skill_evidence_user_idx on public.learning_skill_evidence(user_id, skill_key, occurred_at desc);

alter table public.learning_skill_evidence enable row level security;

-- Learners read only their own evidence. No direct learner INSERT policy: evidence is written
-- by trusted server code (e.g. the create-outcome share route) using the user-scoped client
-- with an explicit user_id=auth.uid() check in the insert itself, or in a future pass by a
-- service-role job — never accepted as arbitrary client input.
create policy "skill evidence self read" on public.learning_skill_evidence for select
  using (user_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));
create policy "skill evidence self insert" on public.learning_skill_evidence for insert
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

alter table public.create_outcome_projects add column skill_keys text[] not null default '{}';

commit;
