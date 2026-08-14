-- H2OBOOK Learning Journey Intelligence V1 (docs/H2O_LEARNING_JOURNEY_AUDIT.md)
--
-- Additive only. Journey Core (career_stages -> academy_stage_nodes, learning_journey_blueprints ->
-- outcomes -> milestones -> missions -> actions) is untouched: no id, no unlock query, no progress
-- calculation is changed by this file.
--
-- learner_experiences (migration 0026) already has the field shape a Daily Practice Log needs
-- (steps_taken, challenges, next_improvement, asset_ids[], instructor_feedback) but was built for
-- Knowledge-Space case studies only (knowledge_space_id not null). This mirrors exactly what
-- migration 0053 did to learner_notes: make the old subject nullable, add a new subject
-- (mission_id), require at least one of the two. Zero real rows exist in learner_experiences today
-- (verified 2026-08-14), so this cannot break any existing row.
--
-- learner_notes is NOT touched here — folder 36's Daily Practice Journal had zero real production
-- rows (resource_type='mission' count = 0, verified 2026-08-14) and is being redirected in
-- application code only (lib/stage1-learning-os/daily-practice.ts), not by schema change. Its other
-- consumer (Reader "Luu vao Hoc & ghi nho") is unrelated and unaffected.

begin;

alter table public.learner_experiences alter column knowledge_space_id drop not null;
alter table public.learner_experiences add column if not exists mission_id uuid references public.learning_journey_missions(id) on delete set null;

alter table public.learner_experiences drop constraint if exists learner_experiences_has_a_subject;
alter table public.leaarner_experiences add constraint learner_experiences_has_a_subject
  check (knowledge_space_id is not null or mission_id is not null);

create index if not exists learner_experiences_mission_idx on public.learner_experiences(mission_id) where mission_id is not null;

-- Learning Journey Intelligence V1 fields. All nullable — no score is a lie about "not yet
-- evaluated"; deterministic aggregation code (lib/learning-journey/*) must treat null as "chua du
-- Evidence", never coerce to 0.
alter table public.learner_experiences add column if not exists journey_day integer;
alter table public.learner_experiences drop constraint if exists learner_experiences_journey_day_range;
alter table public.learner_experiences add constraint learner_experiences_journey_day_range check (journey_day is null or journey_day between 1 and 90);

alter table public.learner_experiences add column if not exists best_result text;
alter table public.learner_experiences add column if not exists suspected_reason text;

alter table public.learner_experiences add column if not exists self_score numeric(5,2);
alter table public.learner_experiences drop constraint if exists learner_experiences_self_score_range;
alter table public.learner_experiences add constraint learner_experiences_self_score_range check (self_score is null or self_score between 0 and 100);

alter table public.learner_experiences add column if not exists instructor_score numeric(5,2);
alter table public.learner_experiences drop constraint if exists learner_experiences_instructor_score_range;
alter table public.learner_experiences add constraint learner_experiences_instructor_score_range check (instructor_score is null or instructor_score between 0 and 100);

alter table public.learner_experiences add column if not exists practice_minutes integer;
alter table public.learner_experiences drop constraint if exists learner_experiences_practice_minutes_range;
alter table public.learner_experiences add constraint learner_experiences_practice_minutes_range check (practice_minutes is null or practice_minutes >= 0);

create index if not exists learner_experiences_mission_day_idx on public.learner_experiences(user_id, mission_id, journey_day) where mission_id is not null;

-- H2OBrain capability snapshot (Weekly / Day30 / Day60 / Day90). Genuinely new concept — nothing
-- existing stores a point-in-time capability assessment. Deterministic metrics computed server-side
-- (lib/learning-journey/snapshots.ts) from real learner_experiences + learning_skill_evidence rows;
-- students never write their own assessment, so insert is staff/service only (mirrors
-- learning_results' "results service write" policy shape from migration 0026).
create table if not exists public.learning_capability_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_type text not null check (snapshot_type in ('weekly','day30','day60','day90')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  journey_day integer,
  entries_count integer not null default 0,
  practice_minutes_total integer not null default 0,
  skill_scores jsonb not null default '{}'::jsonb,
  recurring_reasons jsonb not null default '[]'::jsonb,
  summary text not null default '',
  has_enough_evidence boolean not null default false,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists learning_capability_snapshots_user_idx on public.learning_capability_snapshots(organization_id, user_id, snapshot_type, period_start desc);

alter table public.learning_capability_snapshots enable row level security;

drop policy if exists "capability snapshots self or staff read" on public.learning_capability_snapshots;
create policy "capability snapshots self or staff read" on public.learning_capability_snapshots for select to authenticated
  using (user_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));

drop policy if exists "capability snapshots staff write" on public.learning_capability_snapshots;
create policy "capability snapshots staff write" on public.learning_capability_snapshots for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));

commit;

-- Rollback:
--   drop table if exists public.learning_capability_snapshots;
--   alter table public.learner_experiences drop constraint if exists learner_experiences_has_a_subject;
--   alter table public.learner_experiences drop constraint if exists learner_experiences_journey_day_range;
--   alter table public.learner_experiences drop constraint if exists learner_experiences_self_score_range;
--   alter table public.learner_experiences drop constraint if exists learner_experiences_instructor_score_range;
--   alter table public.learner_experiences drop constraint if exists learner_experiences_practice_minutes_range;
--   alter table public.learner_experiences drop column if exists journey_day;
--   alter table public.learner_experiences drop column if exists best_result;
--   alter table public.learner_experiences drop column if exists suspected_reason;
--   alter table public.learner_experiences drop column if exists self_score;
--   alter table public.learner_experiences drop column if exists instructor_score;
--   alter table public.learner_experiences drop column if exists practice_minutes;
--   alter table public.learner_experiences drop column if exists mission_id;
--   -- knowledge_space_id is left nullable on rollback (case-study rows are unaffected either way)
