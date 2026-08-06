-- H2OBOOK — group career_stage_resources into named programs/modules
--
-- Adapted from v5/20-h2obook-student-experience-builder-final-v2, after the user chose the
-- narrowest of four options offered following an audit that rejected the module's other eleven
-- tables. Full reasoning in docs/module-20-student-experience-builder-audit.md.
--
-- The source module proposed a twelve-table navigation CMS: stage_key as free text disconnected
-- from career_stages.id, a resource-linking table duplicating career_stage_resources, an unlock
-- engine duplicating unlock_mode (0036), and — the highest-risk part — a database-driven
-- replacement for the sidebar lib/student/compact-navigation.ts already renders in production. All
-- of that was rejected. The one real, confirmed gap: career_stage_resources is a flat list per
-- stage, and a stage with dozens of resources has no way to group them under a heading like
-- "Module 1: Nền tảng".
--
-- career_stage_programs is that grouping layer, self-referencing for a program/module hierarchy
-- (a program has modules; a module cannot have further children — enforced by the check below
-- rather than by a recursive walk, since one level of nesting is the actual ask and a depth check
-- is simpler and sufficient for it). It is scoped to a stage via stage_id, a real foreign key —
-- unlike the source module's free-text stage_key, this cannot point at a stage that does not exist.
--
-- career_stage_resources gains one nullable FK: program_id. Nullable because grouping is optional —
-- a stage with few resources needs no groups, and every resource created before this migration
-- reads as ungrouped, which is exactly what it was.

begin;

create table if not exists public.career_stage_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stage_id uuid not null references public.career_stages(id) on delete cascade,
  parent_id uuid references public.career_stage_programs(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  status text not null default 'active' check (status in ('active','hidden','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, parent_id, slug)
);

-- One level of nesting: a program may have modules, a module may not have further children. This
-- is the depth the admin UI actually offers; enforcing it here means a bad insert fails loudly
-- instead of quietly producing a third level the UI cannot render.
create or replace function public.h2obook_career_stage_program_depth_check()
returns trigger language plpgsql as $$
declare
  v_parent_has_parent boolean;
begin
  if new.parent_id is null then
    return new;
  end if;
  select (parent_id is not null) into v_parent_has_parent
  from public.career_stage_programs where id = new.parent_id;
  if v_parent_has_parent is null then
    raise exception 'parent_id does not exist';
  end if;
  if v_parent_has_parent then
    raise exception 'career_stage_programs supports one level of nesting only (program -> module)';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_career_stage_program_depth on public.career_stage_programs;
create trigger trg_career_stage_program_depth
before insert or update of parent_id on public.career_stage_programs
for each row execute function public.h2obook_career_stage_program_depth_check();

create index if not exists career_stage_programs_stage_idx on public.career_stage_programs(stage_id, parent_id, position);

alter table public.career_stage_resources
  add column if not exists program_id uuid references public.career_stage_programs(id) on delete set null;

create index if not exists career_stage_resources_program_idx on public.career_stage_resources(program_id) where program_id is not null;

alter table public.career_stage_programs enable row level security;

drop policy if exists "career stage programs public read" on public.career_stage_programs;
create policy "career stage programs public read" on public.career_stage_programs for select using (status <> 'archived');

drop policy if exists "career stage programs admin write" on public.career_stage_programs;
create policy "career stage programs admin write" on public.career_stage_programs for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop trigger if exists career_stage_programs_domain_event on public.career_stage_programs;
create trigger career_stage_programs_domain_event after insert or update or delete on public.career_stage_programs
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   alter table public.career_stage_resources drop column if exists program_id;
--   drop trigger if exists trg_career_stage_program_depth on public.career_stage_programs;
--   drop function if exists public.h2obook_career_stage_program_depth_check();
--   drop table if exists public.career_stage_programs;
-- Additive throughout; every resource created before or after this migration keeps working
-- ungrouped if the program it pointed at is ever removed, because program_id is ON DELETE SET NULL.
