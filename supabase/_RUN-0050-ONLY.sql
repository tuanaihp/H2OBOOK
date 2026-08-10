-- H2OBOOK — Learn Outcome OS V1: an execution/outcome graph layered on the existing curriculum
--
-- Prepares the schema for v5/28-H2OBOOK_LEARN_OUTCOME_OS_V1. Full audit in
-- docs/learn-outcome-os/01_CURRENT_LEARN_AUDIT.md — most of what this package's README describes
-- ("Journey Map → Learn & Remember → Smart Library → Action & Results → Review") already exists
-- pragmatically (portfolio_ready evidence, Smart Home, H2O Mentor, real assignment/rubric system).
-- What does NOT exist: an admin-authored, versioned map of Outcome → Milestone → Mission → Action
-- that a student's progress can be measured against, independent of raw course/lesson completion.
-- That is what this migration adds — additively, alongside the curriculum graph, never replacing it.
--
-- Two graphs, two jobs (docs/learn-outcome-os/docs/ARCHITECTURE.md from the source package):
--   Curriculum graph (career_stages -> academy_stage_nodes -> career_stage_resources): "what to learn".
--   Outcome graph (this migration): "what to do to reach a result". A Mission never copies a
--   resource — it binds to one that already exists (career_stage_resources / content_items /
--   assignment_definitions), so the curriculum stays the single source of truth for content.
--
-- One blueprint per stage; blueprints version (draft -> published -> archived) so a student
-- partway through a mission is never silently moved to a different graph mid-journey — the
-- pattern already established for academy_stage_ui_config (migration 0041) at the UI-config
-- grain, applied here at the graph-content grain. current_published_version_id lets a student's
-- read resolve in one query instead of a status scan across every version.

begin;

create table if not exists public.learning_journey_blueprints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stage_id uuid not null references public.career_stages(id) on delete cascade,
  title text not null,
  current_published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stage_id)
);

create table if not exists public.learning_journey_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  blueprint_id uuid not null references public.learning_journey_blueprints(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (blueprint_id, version_number)
);

alter table public.learning_journey_blueprints
  drop constraint if exists learning_journey_blueprints_current_version_fk;
alter table public.learning_journey_blueprints
  add constraint learning_journey_blueprints_current_version_fk
  foreign key (current_published_version_id) references public.learning_journey_versions(id) on delete set null;

-- At most one published version per blueprint — publishing a new one must archive the old one in
-- the same transaction rather than leaving two "published" at once for a resolver to pick between.
create unique index if not exists learning_journey_versions_one_published_idx
  on public.learning_journey_versions(blueprint_id) where status = 'published';

create table if not exists public.learning_journey_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_id uuid not null references public.learning_journey_versions(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0
);

create table if not exists public.learning_journey_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  outcome_id uuid not null references public.learning_journey_outcomes(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0
);

create table if not exists public.learning_journey_missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  milestone_id uuid not null references public.learning_journey_milestones(id) on delete cascade,
  title text not null,
  description text,
  expected_result text not null default '',
  estimated_days integer,
  prerequisite_mission_id uuid references public.learning_journey_missions(id) on delete set null,
  -- evidence_required: a submitted evidence row is enough. teacher_verified: portfolio_ready must be
  -- set (see lib/teaching/grading.ts's canPublishEvidence) — reuses the same decision every graded
  -- submission already produces, not a second verification step. metric_based / self_reported:
  -- lighter-weight missions that do not need instructor review.
  completion_policy text not null default 'evidence_required'
    check (completion_policy in ('evidence_required', 'teacher_verified', 'metric_based', 'self_reported')),
  success_criteria jsonb not null default '[]'::jsonb,
  evidence_policy jsonb not null default '{}'::jsonb,
  position integer not null default 0
);

create index if not exists learning_journey_missions_prerequisite_idx
  on public.learning_journey_missions(prerequisite_mission_id) where prerequisite_mission_id is not null;

-- Bindings: a mission points at content that already exists, it never owns or copies it.
-- resource_type/resource_id deliberately mirror career_stage_resources' own polymorphic shape
-- (text discriminator + id, not a typed FK) for the same reason that table isn't one either — the
-- source can be career_stage_resources, content_items, or a future kind, and adding a new one must
-- never require a migration here.

create table if not exists public.learning_mission_resource_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null references public.learning_journey_missions(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  role text not null default 'required' check (role in ('required', 'recommended')),
  position integer not null default 0
);

create table if not exists public.learning_mission_tool_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null references public.learning_journey_missions(id) on delete cascade,
  tool_type text not null,
  tool_id uuid not null,
  role text not null default 'recommended' check (role in ('required', 'recommended')),
  position integer not null default 0
);

-- Assignments are the one binding kind with a single real table behind them
-- (assignment_definitions — lib/student/assignments.ts), so this one gets a real FK.
create table if not exists public.learning_mission_assignment_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null references public.learning_journey_missions(id) on delete cascade,
  assignment_id uuid not null references public.assignment_definitions(id) on delete cascade,
  role text not null default 'required' check (role in ('required', 'recommended')),
  position integer not null default 0
);

create table if not exists public.learning_mission_action_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null references public.learning_journey_missions(id) on delete cascade,
  title text not null,
  description text,
  required boolean not null default true,
  day_offset integer,
  evidence_required boolean not null default false,
  position integer not null default 0
);

-- Student-owned execution state. blueprint_version_id is pinned at mission start (never re-derived
-- from "whatever is published now") — the same reason academy_stage_ui_config versions instead of
-- overwriting: a student mid-mission must not have the graph change under them when Admin publishes
-- v2. New students simply start on whatever is published at the time they first read the blueprint.
create table if not exists public.student_mission_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.learning_journey_missions(id) on delete cascade,
  blueprint_version_id uuid not null references public.learning_journey_versions(id) on delete cascade,
  state text not null default 'not_started' check (state in (
    'not_started', 'learning', 'planning', 'doing', 'evidence_pending', 'review_pending',
    'verified', 'result_achieved', 'blocked'
  )),
  progress_percent numeric not null default 0 check (progress_percent between 0 and 100),
  started_at timestamptz,
  verified_at timestamptz,
  result_achieved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, mission_id, blueprint_version_id)
);

create index if not exists student_mission_states_student_idx
  on public.student_mission_states(organization_id, student_id, state);

-- source_type/source_id mirror the bindings' polymorphic shape: an action can come from a mission's
-- own action templates, an assignment, a student's personal plan, a tool, or a mentor suggestion —
-- one execution queue, not five (docs/learn-outcome-os §7 "Execution Queue phải hợp nhất").
create table if not exists public.student_learning_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid references public.learning_journey_missions(id) on delete set null,
  source_type text not null check (source_type in (
    'mission_template', 'assignment', 'personal_plan', 'tool_generated', 'mentor_suggestion'
  )),
  source_id uuid,
  title text not null,
  status text not null default 'planned' check (status in ('planned', 'doing', 'completed', 'skipped')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists student_learning_actions_student_date_idx
  on public.student_learning_actions(organization_id, student_id, due_date, status);

alter table public.learning_journey_blueprints enable row level security;
alter table public.learning_journey_versions enable row level security;
alter table public.learning_journey_outcomes enable row level security;
alter table public.learning_journey_milestones enable row level security;
alter table public.learning_journey_missions enable row level security;
alter table public.learning_mission_resource_bindings enable row level security;
alter table public.learning_mission_tool_bindings enable row level security;
alter table public.learning_mission_assignment_bindings enable row level security;
alter table public.learning_mission_action_templates enable row level security;
alter table public.student_mission_states enable row level security;
alter table public.student_learning_actions enable row level security;

-- Blueprint graph tables: owner/admin write; every org member may read (draft included) — the
-- "student never sees draft" guarantee is enforced by the app only ever querying the blueprint's
-- current_published_version_id, never a version by status, not by hiding rows from every role.
-- (Same trust boundary academy_stage_ui_config already relies on for the same reason.)
do $$
declare
  graph_table text;
begin
  foreach graph_table in array array[
    'learning_journey_blueprints', 'learning_journey_versions', 'learning_journey_outcomes',
    'learning_journey_milestones', 'learning_journey_missions', 'learning_mission_resource_bindings',
    'learning_mission_tool_bindings', 'learning_mission_assignment_bindings', 'learning_mission_action_templates'
  ]
  loop
    execute format('drop policy if exists "%s org read" on public.%I', graph_table, graph_table);
    execute format(
      'create policy "%s org read" on public.%I for select to authenticated using (public.is_org_member(organization_id))',
      graph_table, graph_table
    );
    execute format('drop policy if exists "%s admin write" on public.%I', graph_table, graph_table);
    execute format(
      'create policy "%s admin write" on public.%I for all to authenticated using (public.has_org_role(organization_id, array[''owner'',''admin'']::public.member_role[])) with check (public.has_org_role(organization_id, array[''owner'',''admin'']::public.member_role[]))',
      graph_table, graph_table
    );
  end loop;
end $$;

-- Student execution tables: a student reads/writes only their own rows; owner/admin/teacher can read
-- every student's (for review and the Admin Journey Builder's own preview) but not write them —
-- mission state and actions are the student's own record of what they did, never edited on their
-- behalf. Reuses the same has_org_role/is_org_member helpers as everything else in this repo.
drop policy if exists "student mission states own read" on public.student_mission_states;
create policy "student mission states own read" on public.student_mission_states for select to authenticated
using (student_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));

drop policy if exists "student mission states own write" on public.student_mission_states;
create policy "student mission states own write" on public.student_mission_states for all to authenticated
using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists "student learning actions own read" on public.student_learning_actions;
create policy "student learning actions own read" on public.student_learning_actions for select to authenticated
using (student_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));

drop policy if exists "student learning actions own write" on public.student_learning_actions;
create policy "student learning actions own write" on public.student_learning_actions for all to authenticated
using (student_id = auth.uid()) with check (student_id = auth.uid());

drop trigger if exists learning_journey_blueprints_domain_event on public.learning_journey_blueprints;
create trigger learning_journey_blueprints_domain_event after insert or update or delete on public.learning_journey_blueprints
for each row execute function public.capture_domain_event();
drop trigger if exists learning_journey_versions_domain_event on public.learning_journey_versions;
create trigger learning_journey_versions_domain_event after insert or update or delete on public.learning_journey_versions
for each row execute function public.capture_domain_event();
drop trigger if exists learning_journey_missions_domain_event on public.learning_journey_missions;
create trigger learning_journey_missions_domain_event after insert or update or delete on public.learning_journey_missions
for each row execute function public.capture_domain_event();
drop trigger if exists student_mission_states_domain_event on public.student_mission_states;
create trigger student_mission_states_domain_event after insert or update or delete on public.student_mission_states
for each row execute function public.capture_domain_event();
drop trigger if exists student_learning_actions_domain_event on public.student_learning_actions;
create trigger student_learning_actions_domain_event after insert or update or delete on public.student_learning_actions
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   drop trigger if exists student_learning_actions_domain_event on public.student_learning_actions;
--   drop trigger if exists student_mission_states_domain_event on public.student_mission_states;
--   drop trigger if exists learning_journey_missions_domain_event on public.learning_journey_missions;
--   drop trigger if exists learning_journey_versions_domain_event on public.learning_journey_versions;
--   drop trigger if exists learning_journey_blueprints_domain_event on public.learning_journey_blueprints;
--   drop table if exists public.student_learning_actions;
--   drop table if exists public.student_mission_states;
--   drop table if exists public.learning_mission_action_templates;
--   drop table if exists public.learning_mission_assignment_bindings;
--   drop table if exists public.learning_mission_tool_bindings;
--   drop table if exists public.learning_mission_resource_bindings;
--   drop table if exists public.learning_journey_missions;
--   drop table if exists public.learning_journey_milestones;
--   drop table if exists public.learning_journey_outcomes;
--   alter table public.learning_journey_blueprints drop constraint if exists learning_journey_blueprints_current_version_fk;
--   drop table if exists public.learning_journey_versions;
--   drop table if exists public.learning_journey_blueprints;
