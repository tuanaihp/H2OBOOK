-- H2OBOOK H2O Coach OS V1 (docs/h2o-coach-v1/01_PRODUCTION_AUDIT.md)
--
-- Additive only. Does not touch career_stages, learning_journey_missions, blueprint/version/outcome/
-- milestone tables, student_mission_states/student_learning_actions (canonical completion resolver),
-- learning_mission_workspace_configs/student_mission_workspace_values, learning_skill_evidence, or
-- learner_experiences. Coach reads all of those; none of them are altered here.
--
-- 5 tables, none of which have an existing canonical equivalent (see audit §1-2):
--   1) coach_stage_profiles / coach_stage_profile_versions — versioned per-Stage Coach config,
--      mirrors learning_journey_blueprints/_versions' exact draft->publish->rollback shape
--      (migration 0050) down to the same current_published_version_id pointer pattern.
--   2) coach_mission_configs — per-Mission coaching rules/fields, scoped to one profile version.
--   3) learner_memory_values — structured cross-Mission learner memory with provenance. Not the same
--      as student_mission_workspace_values (per-Mission form UI state, no namespace/cross-mission
--      reuse, no confirm/reject) or learner_experiences (Daily Log history, not single-value facts).
--   4) coach_conversations — one row per (learner, mission) holding message history as a bounded
--      jsonb array, not one row per message (avoids row explosion, no existing chat/message table
--      found anywhere in the schema to reuse).

begin;

create table if not exists public.coach_stage_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stage_id uuid not null references public.career_stages(id) on delete cascade,
  current_published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stage_id)
);

create table if not exists public.coach_stage_profile_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.coach_stage_profiles(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  name text not null default '',
  coach_role text not null default '',
  system_tone text not null default '',
  provider_mode text not null default 'offline' check (provider_mode in ('offline','hybrid','ai')),
  knowledge_scope jsonb not null default '{}'::jsonb,
  memory_schema jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id, version_number)
);

alter table public.coach_stage_profiles drop constraint if exists coach_stage_profiles_current_version_fk;
alter table public.coach_stage_profiles add constraint coach_stage_profiles_current_version_fk
  foreign key (current_published_version_id) references public.coach_stage_profile_versions(id) on delete set null;

create table if not exists public.coach_mission_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_version_id uuid not null references public.coach_stage_profile_versions(id) on delete cascade,
  mission_id uuid not null references public.learning_journey_missions(id) on delete cascade,
  objective text not null default '',
  required_fields text[] not null default '{}',
  questions jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  result_template jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_version_id, mission_id)
);

-- field_key is the full dotted identity ("career.direction"); namespace is mechanically derived
-- (split on first ".") and stored denormalized purely so callers can filter by namespace without
-- parsing every row's key — always written by lib/h2o-coach/memory.ts, never a second source of truth.
create table if not exists public.learner_memory_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  namespace text not null,
  field_key text not null,
  value jsonb not null,
  status text not null default 'proposed' check (status in ('proposed','confirmed','rejected')),
  confidence numeric(4,3),
  source_mission_id uuid references public.learning_journey_missions(id) on delete set null,
  source_message_id text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, learner_id, field_key)
);

create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.learning_journey_missions(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, learner_id, mission_id)
);

create index if not exists coach_stage_profile_versions_profile_idx on public.coach_stage_profile_versions(profile_id, version_number desc);
create index if not exists coach_mission_configs_profile_version_idx on public.coach_mission_configs(profile_version_id);
create index if not exists learner_memory_values_learner_idx on public.learner_memory_values(organization_id, learner_id, namespace);
create index if not exists coach_conversations_learner_mission_idx on public.coach_conversations(organization_id, learner_id, mission_id);

alter table public.coach_stage_profiles enable row level security;
alter table public.coach_stage_profile_versions enable row level security;
alter table public.coach_mission_configs enable row level security;
alter table public.learner_memory_values enable row level security;
alter table public.coach_conversations enable row level security;

-- coach_stage_profiles / _versions / mission_configs: same "org read + admin write" shape migration
-- 0050 uses for learning_journey_blueprints/_versions — drafts are readable at the RLS layer (any org
-- member) but never fetched by student-facing queries, which only ever resolve through
-- current_published_version_id (see migration 0050 line ~210's identical reasoning). Security is by
-- query shape, not by hiding rows from a role, matching the established convention exactly.
create policy "coach stage profiles org read" on public.coach_stage_profiles for select to authenticated
  using (public.is_org_member(organization_id));
create policy "coach stage profiles admin write" on public.coach_stage_profiles for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "coach stage profile versions org read" on public.coach_stage_profile_versions for select to authenticated
  using (public.is_org_member(organization_id));
create policy "coach stage profile versions admin write" on public.coach_stage_profile_versions for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "coach mission configs org read" on public.coach_mission_configs for select to authenticated
  using (public.is_org_member(organization_id));
create policy "coach mission configs admin write" on public.coach_mission_configs for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

-- learner_memory_values / coach_conversations are personal data (own profile facts, own chat), not
-- org-wide readable — self + owner/admin/teacher, matching learner_experiences' exact policy shape.
create policy "learner memory self read" on public.learner_memory_values for select to authenticated
  using (learner_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));
create policy "learner memory self write" on public.learner_memory_values for all to authenticated
  using (learner_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]))
  with check (learner_id = auth.uid() and public.is_org_member(organization_id));

create policy "coach conversations self read" on public.coach_conversations for select to authenticated
  using (learner_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));
create policy "coach conversations self write" on public.coach_conversations for all to authenticated
  using (learner_id = auth.uid())
  with check (learner_id = auth.uid() and public.is_org_member(organization_id));

commit;

-- Rollback:
--   drop table if exists public.coach_conversations;
--   drop table if exists public.learner_memory_values;
--   drop table if exists public.coach_mission_configs;
--   alter table public.coach_stage_profiles drop constraint if exists coach_stage_profiles_current_version_fk;
--   drop table if exists public.coach_stage_profile_versions;
--   drop table if exists public.coach_stage_profiles;
