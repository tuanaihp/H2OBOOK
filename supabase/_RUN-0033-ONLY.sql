-- H2OBOOK Career Stage Curriculum
--
-- The problem this closes: career stages exist twice as hardcoded TypeScript arrays —
-- lib/public-site/content.ts (learningPaths, drives the public /academy/learning-paths page) and
-- lib/student/experience.ts (studentCareerStages, drives the student roadmap and the stage-lock
-- system in lib/student/stage-access.ts). Both list the same five stages, neither can be edited
-- without a deploy, and crucially there is no link at all between a stage and the material that
-- belongs to it. That is why /student/library falls back to the local demo store: there is no
-- table that could answer "which books belong to stage 1".
--
-- Audit before adding anything, per the project's one-domain-one-source-of-truth rule:
--   * entitlements (0001) — per-user access grants. Answers "may THIS student open resource X",
--     not "what belongs to stage 1". Different question; kept as-is and still the access gate.
--   * business_feature_grants (0030) — per-student manual stage unlocks. Again per-user.
--   * memberships (0001) — per-user subscription state.
--   * libraries + library_publications (0002) — a generic ordered shelf of publications. Closest
--     existing shape, but it only addresses `publications`, carries no stage metadata, and is
--     dead code: nothing under lib/ or app/ references either table. Overloading a dead generic
--     table with career-stage semantics would bury the meaning rather than model it, so it is
--     left untouched and flagged separately for removal or revival.
-- Conclusion: the curriculum map is a genuinely new domain. Two tables, no duplication.
--
-- career_stage_resources deliberately addresses material the same way entitlements does —
-- resource_type + resource_id, no foreign key — so a stage mapping and an access grant speak the
-- same language and one can be derived from the other. The cost is the usual polymorphic one: no
-- referential integrity on resource_id. That cost is already paid elsewhere in this schema, and
-- paying it again is better than five nullable typed columns.

begin;

create table if not exists public.career_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  position integer not null default 0,
  index_label text,
  title text not null,
  subtitle text,
  description text,
  duration_label text,
  skills text[] not null default '{}',
  status text not null default 'active' check (status in ('active','hidden','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, slug)
);

create table if not exists public.career_stage_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stage_id uuid not null references public.career_stages(id) on delete cascade,
  resource_type text not null check (resource_type in ('book','course','publication','template','knowledge_space','roadmap','link')),
  resource_id text not null,
  title_override text,
  summary text,
  href text,
  position integer not null default 0,
  -- free_preview is the taster a signed-out visitor or a student who has not reached this stage
  -- may open; stage_locked needs the stage unlocked; entitlement_only defers entirely to a grant
  -- in public.entitlements.
  access text not null default 'stage_locked' check (access in ('free_preview','stage_locked','entitlement_only')),
  status text not null default 'active' check (status in ('active','hidden','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stage_id, resource_type, resource_id)
);

create index if not exists career_stages_org_position_idx on public.career_stages(organization_id, position);
create index if not exists career_stage_resources_stage_position_idx on public.career_stage_resources(stage_id, position);

alter table public.career_stages enable row level security;
alter table public.career_stage_resources enable row level security;

-- Read is intentionally open to anyone: the public learning-paths page and its free-preview
-- material must render for visitors with no session at all. Nothing sensitive lives in either
-- table — they hold the shape of the curriculum, not anyone's access to it. Whether a given
-- student may actually open a resource is still decided by entitlements and the stage-unlock
-- rules in lib/student/stage-access.ts, both unchanged by this migration.
create policy "career stages public read" on public.career_stages for select using (status <> 'archived');
create policy "career stage resources public read" on public.career_stage_resources for select using (status <> 'archived');

create policy "career stages admin write" on public.career_stages for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "career stage resources admin write" on public.career_stage_resources for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create trigger career_stages_domain_event after insert or update or delete on public.career_stages
for each row execute function public.capture_domain_event();

create trigger career_stage_resources_domain_event after insert or update or delete on public.career_stage_resources
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   drop table if exists public.career_stage_resources;
--   drop table if exists public.career_stages;
-- Both are additive and nothing else references them, so dropping restores the previous state
-- exactly; the hardcoded arrays remain in the codebase as the fallback either way.
