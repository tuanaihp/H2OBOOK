-- H2OBOOK — Universal Mission Workspace V1: block-based config for "Làm việc" inside a Mission
--
-- Prepares the schema for v5/30-H2OBOOK_SMART_ROADMAP_MISSION_OS_V1, Release 1 only (schema +
-- Admin block builder in Draft — no student-facing workspace route yet, see
-- docs/smart-learning/01_PRODUCTION_AUDIT.md for the full scope decision).
--
-- Audited first whether a generic block/form system already existed: learning_blocks +
-- learning_sections (migration 0026) is real and close in spirit (typed blocks, payload jsonb,
-- position, required), but it belongs to knowledge_space_versions — a different, already-versioned
-- content domain (what a student reads) — not journey_version_id + mission_id (what a student does,
-- pinned to the Journey version they started on). Reusing it would mean either faking a Knowledge
-- Space per Mission or bolting a second, unrelated version concept onto learning_block_type — both
-- worse than two small, purpose-built tables. Block type *names* still borrow learning_block_type's
-- vocabulary where the concept is genuinely the same (checklist, assignment, result), so the same
-- word means the same thing everywhere in this database.
--
-- One config row per (journey_version_id, mission_id) holding the block list as jsonb, matching the
-- source package's own reference schema — the block list is edited as a unit by one admin at a time
-- through the Journey Builder, not queried block-by-block, so a jsonb array is simpler than a child
-- table here and still keeps each block's `id` stable inside it. Student answers are the one place
-- that must scale per-row (one student's own values, queried by student+mission+version), so those
-- get a real table, matching the same reasoning migration 0036 used for criterion_scores (jsonb
-- would work but a table lets `stable id, student_id, mission_id, block_id` be indexed and RLS'd
-- directly rather than filtered out of a blob).

begin;

create table if not exists public.learning_mission_workspace_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  journey_version_id uuid not null references public.learning_journey_versions(id) on delete cascade,
  mission_id uuid not null references public.learning_journey_missions(id) on delete cascade,
  schema_version text not null default '1.0',
  blocks jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, journey_version_id, mission_id)
);

create table if not exists public.student_mission_workspace_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  journey_version_id uuid not null references public.learning_journey_versions(id) on delete cascade,
  mission_id uuid not null references public.learning_journey_missions(id) on delete cascade,
  block_id text not null,
  value jsonb,
  status text not null default 'draft' check (status in ('draft', 'saved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, student_id, journey_version_id, mission_id, block_id)
);

create index if not exists student_mission_workspace_values_student_mission_idx
  on public.student_mission_workspace_values(organization_id, student_id, mission_id);

alter table public.learning_mission_workspace_configs enable row level security;
alter table public.student_mission_workspace_values enable row level security;

-- Same read/write split as every other Journey table (migration 0050): org members read, owner/admin
-- write. Draft-vs-published visibility is enforced by the app only ever resolving a student's
-- workspace through their assigned journey_version_id, the same trust boundary
-- academy_stage_ui_config and the Journey graph itself already rely on.
drop policy if exists "mission workspace configs org read" on public.learning_mission_workspace_configs;
create policy "mission workspace configs org read" on public.learning_mission_workspace_configs for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "mission workspace configs admin write" on public.learning_mission_workspace_configs;
create policy "mission workspace configs admin write" on public.learning_mission_workspace_configs for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

-- A student's own answers only — the same "own row, no exceptions" shape as
-- student_learning_actions. Unlike student_mission_states, no owner/admin/teacher read-all policy
-- is added here: nothing in Release 1 needs to review raw block values yet (that is Release 3's
-- Result Card, which reads through a server read model, not directly).
drop policy if exists "student mission workspace values own" on public.student_mission_workspace_values;
create policy "student mission workspace values own" on public.student_mission_workspace_values for all to authenticated
using (student_id = auth.uid()) with check (student_id = auth.uid());

drop trigger if exists learning_mission_workspace_configs_domain_event on public.learning_mission_workspace_configs;
create trigger learning_mission_workspace_configs_domain_event after insert or update or delete on public.learning_mission_workspace_configs
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   drop trigger if exists learning_mission_workspace_configs_domain_event on public.learning_mission_workspace_configs;
--   drop table if exists public.student_mission_workspace_values;
--   drop table if exists public.learning_mission_workspace_configs;
