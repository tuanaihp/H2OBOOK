-- H2OBOOK Academy Control Center V2 — content catalog + Program/Module/Group hierarchy
--
-- Adapted from v5/22-H2OBOOK_ACADEMY_CONTROL_CENTER_FINAL_V3, itself written against
-- docs/academy-control-center-v2-architecture-plan.md after auditing v5/21-H2OBOOK_ACADEMY_CONTROL_CENTER_V1.
-- The source package was unusually disciplined already (reuses career_stages/career_stage_resources/
-- entitlements/assets, casts array['owner','admin']::public.member_role[], drops policies/triggers
-- before recreating). Two real changes made here:
--
-- 1. content_items.content_type is narrowed to the five types that have a real source table in this
--    repo (book/publication/template/knowledge_space/asset). The source package's list also included
--    'course', 'roadmap', 'link', 'article', 'checklist', 'sop', 'worksheet', 'quiz', 'flashcard',
--    'rubric', 'case_study' — none of those have a dedicated content table, and 'course' was
--    explicitly excluded by product decision (academy_courses stays its own domain, see step 7
--    below). Cataloging types with nothing to catalog is exactly the "design for a need not yet
--    proven" pattern this repo's migrations avoid elsewhere.
-- 2. A one-time backfill populates content_items from the five real source tables, so the catalog
--    is usable on first deploy instead of starting empty.
--
-- career_stage_programs (migration 0040, deployed the same day as this file with no admin-entered
-- data yet) is superseded by academy_stage_nodes: one generic self-referencing table for
-- program/module/group instead of two separate tables. Its rows are copied forward; the table and
-- career_stage_resources.program_id are left in place (not dropped) so nothing already reading them
-- breaks — the application layer simply stops writing to them after this migration ships.

begin;

-- 1. Content catalog -----------------------------------------------------------------------------
-- A browsing index, not a content store: source_table/source_id always point back at the real row,
-- and career_stage_resources keeps writing resource_type/resource_id against that real row, never
-- against content_items.id. Deleting a content_items row therefore never orphans anything it was
-- used to attach.

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_type text not null check (content_type in ('book','publication','template','knowledge_space','asset')),
  source_table text not null check (source_table in ('books','publications','templates','knowledge_spaces','assets')),
  source_id uuid not null,
  title text not null,
  summary text,
  cover_asset_id uuid references public.assets(id) on delete set null,
  tags text[] not null default '{}',
  reuse_count integer not null default 0 check (reuse_count >= 0),
  status text not null default 'active' check (status in ('active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_table, source_id)
);

create index if not exists content_items_org_type_idx on public.content_items(organization_id, content_type, status);
create index if not exists content_items_search_idx on public.content_items using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'')));

-- One-time backfill so the catalog is not empty on first deploy. Re-running this migration is safe:
-- the unique(organization_id, source_table, source_id) constraint makes every insert idempotent.
insert into public.content_items (organization_id, content_type, source_table, source_id, title, summary, status)
select b.organization_id, 'book', 'books', b.id, b.title, nullif(b.description, ''), case when b.status = 'archived' then 'archived' else 'active' end
from public.books b
where b.deleted_at is null
on conflict (organization_id, source_table, source_id) do nothing;

insert into public.content_items (organization_id, content_type, source_table, source_id, title, summary, status)
select p.organization_id, 'publication', 'publications', p.id, b.title, nullif(b.description, ''), case when p.status = 'archived' then 'archived' else 'active' end
from public.publications p
join public.books b on b.id = p.book_id
on conflict (organization_id, source_table, source_id) do nothing;

insert into public.content_items (organization_id, content_type, source_table, source_id, title, status)
select t.organization_id, 'template', 'templates', t.id, t.name, case when t.status = 'archived' then 'archived' else 'active' end
from public.templates t
on conflict (organization_id, source_table, source_id) do nothing;

insert into public.content_items (organization_id, content_type, source_table, source_id, title, summary, tags, status)
select k.organization_id, 'knowledge_space', 'knowledge_spaces', k.id, k.title, nullif(k.description, ''), k.tags, case when k.status = 'archived' then 'archived' else 'active' end
from public.knowledge_spaces k
on conflict (organization_id, source_table, source_id) do nothing;

insert into public.content_items (organization_id, content_type, source_table, source_id, title, cover_asset_id, status)
select a.organization_id, 'asset', 'assets', a.id, a.original_name, a.id, case when a.status = 'archived' then 'archived' else 'active' end
from public.assets a
on conflict (organization_id, source_table, source_id) do nothing;

-- content_items has no write-through trigger from each source table — five triggers for a picker
-- index is more machinery than the problem needs. Instead this callable function repeats the same
-- backfill for one organization, with ON CONFLICT DO UPDATE so it also refreshes title/status drift,
-- for the admin UI's "Đồng bộ lại danh mục" action to call on demand.
create or replace function public.h2obook_sync_content_catalog(p_organization_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_org_role(p_organization_id, array['owner','admin']::public.member_role[]) then
    raise exception 'not authorized';
  end if;

  insert into public.content_items (organization_id, content_type, source_table, source_id, title, summary, status)
  select b.organization_id, 'book', 'books', b.id, b.title, nullif(b.description, ''), case when b.status = 'archived' then 'archived' else 'active' end
  from public.books b where b.organization_id = p_organization_id and b.deleted_at is null
  on conflict (organization_id, source_table, source_id) do update set title = excluded.title, summary = excluded.summary, status = excluded.status, updated_at = now();

  insert into public.content_items (organization_id, content_type, source_table, source_id, title, summary, status)
  select p.organization_id, 'publication', 'publications', p.id, b.title, nullif(b.description, ''), case when p.status = 'archived' then 'archived' else 'active' end
  from public.publications p join public.books b on b.id = p.book_id
  where p.organization_id = p_organization_id
  on conflict (organization_id, source_table, source_id) do update set title = excluded.title, summary = excluded.summary, status = excluded.status, updated_at = now();

  insert into public.content_items (organization_id, content_type, source_table, source_id, title, status)
  select t.organization_id, 'template', 'templates', t.id, t.name, case when t.status = 'archived' then 'archived' else 'active' end
  from public.templates t where t.organization_id = p_organization_id
  on conflict (organization_id, source_table, source_id) do update set title = excluded.title, status = excluded.status, updated_at = now();

  insert into public.content_items (organization_id, content_type, source_table, source_id, title, summary, tags, status)
  select k.organization_id, 'knowledge_space', 'knowledge_spaces', k.id, k.title, nullif(k.description, ''), k.tags, case when k.status = 'archived' then 'archived' else 'active' end
  from public.knowledge_spaces k where k.organization_id = p_organization_id
  on conflict (organization_id, source_table, source_id) do update set title = excluded.title, summary = excluded.summary, tags = excluded.tags, status = excluded.status, updated_at = now();

  insert into public.content_items (organization_id, content_type, source_table, source_id, title, cover_asset_id, status)
  select a.organization_id, 'asset', 'assets', a.id, a.original_name, a.id, case when a.status = 'archived' then 'archived' else 'active' end
  from public.assets a where a.organization_id = p_organization_id
  on conflict (organization_id, source_table, source_id) do update set title = excluded.title, status = excluded.status, updated_at = now();
end;
$$;

-- 2. Program / Module / Group hierarchy -----------------------------------------------------------
-- One self-referencing table instead of career_stage_programs' two-level design (migration 0040):
-- node_type distinguishes program/module/group, and the trigger below enforces that a module's
-- parent is always a program and a group's parent is always a module — the three-level depth the
-- admin UI actually offers, checked at the database rather than by a recursive walk.

create table if not exists public.academy_stage_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stage_id uuid not null references public.career_stages(id) on delete cascade,
  parent_id uuid references public.academy_stage_nodes(id) on delete cascade,
  node_type text not null check (node_type in ('program','module','group')),
  title text not null,
  description text,
  position integer not null default 0,
  status text not null default 'active' check (status in ('active','hidden','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_stage_nodes_stage_idx on public.academy_stage_nodes(organization_id, stage_id, parent_id, position);

create or replace function public.h2obook_validate_stage_node_depth()
returns trigger language plpgsql as $$
declare
  parent_record public.academy_stage_nodes%rowtype;
begin
  if new.node_type = 'program' then
    if new.parent_id is not null then
      raise exception 'program node must not have a parent';
    end if;
    return new;
  end if;

  if new.parent_id is null then
    raise exception '% node requires a parent', new.node_type;
  end if;

  select * into parent_record from public.academy_stage_nodes where id = new.parent_id;
  if not found then
    raise exception 'parent node does not exist';
  end if;
  if parent_record.organization_id <> new.organization_id or parent_record.stage_id <> new.stage_id then
    raise exception 'cross organization/stage parent is not allowed';
  end if;
  if new.node_type = 'module' and parent_record.node_type <> 'program' then
    raise exception 'module parent must be a program';
  end if;
  if new.node_type = 'group' and parent_record.node_type <> 'module' then
    raise exception 'group parent must be a module';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_h2obook_validate_stage_node_depth on public.academy_stage_nodes;
create trigger trg_h2obook_validate_stage_node_depth
before insert or update on public.academy_stage_nodes
for each row execute function public.h2obook_validate_stage_node_depth();

-- 3. career_stage_resources gains a node pointer, a nav-section tag, and a feature flag ------------
-- No unlock/visibility columns here on purpose: access is already fully solved by
-- access/unlock_mode/prerequisite_binding_id/required_progress/unlock_at (migrations 0034/0036) and
-- lib/content-access/resolver.ts. Duplicating that as a second jsonb unlock_rule column is the exact
-- mistake docs/module-20-student-experience-builder-audit.md flagged in the original source module.

alter table public.career_stage_resources add column if not exists node_id uuid references public.academy_stage_nodes(id) on delete set null;
alter table public.career_stage_resources add column if not exists surface text;
alter table public.career_stage_resources add column if not exists is_featured boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'career_stage_resources_surface_check') then
    alter table public.career_stage_resources add constraint career_stage_resources_surface_check
      check (surface is null or surface in ('learn','create','business','coaching'));
  end if;
end $$;

create index if not exists career_stage_resources_node_idx on public.career_stage_resources(node_id) where node_id is not null;

-- 4. Student Experience Builder config -------------------------------------------------------------
-- One row per draft/published/archived version per stage, config as jsonb. This is deliberately not
-- the 3-table draft/publish/rollback CMS the original module 20 proposed — a version integer plus a
-- status column is enough to author and publish, and a heavier versioning system can be added later
-- if it turns out to be needed, not because it might be.
--
-- This migration ships the schema only. Nothing reads academy_stage_ui_config for a live student
-- yet — lib/student/compact-navigation.ts keeps deciding what students see until a separate,
-- feature-flagged cutover is done deliberately, per docs/academy-control-center-v2-architecture-plan.md §3.

create table if not exists public.academy_stage_ui_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stage_id uuid not null references public.career_stages(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  config jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stage_id, version)
);

create unique index if not exists academy_stage_ui_one_published_idx on public.academy_stage_ui_config(organization_id, stage_id) where status = 'published';

-- 5. Legacy career_stage_programs -> academy_stage_nodes copy ---------------------------------------
-- Guarded by to_regclass so this migration still runs cleanly in an environment where 0040 was never
-- applied. Copies only — career_stage_programs and career_stage_resources.program_id are left alone.

do $$
begin
  if to_regclass('public.career_stage_programs') is not null then
    insert into public.academy_stage_nodes (id, organization_id, stage_id, parent_id, node_type, title, description, position, status, metadata)
    select p.id, p.organization_id, p.stage_id, p.parent_id,
           case when p.parent_id is null then 'program' else 'module' end,
           p.title, p.description, coalesce(p.position, 0), coalesce(p.status, 'active'), '{}'::jsonb
    from public.career_stage_programs p
    on conflict (id) do nothing;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'career_stage_resources' and column_name = 'program_id') then
      update public.career_stage_resources
      set node_id = program_id
      where node_id is null and program_id is not null;
    end if;
  end if;
end $$;

-- 6. RLS --------------------------------------------------------------------------------------------

alter table public.content_items enable row level security;
alter table public.academy_stage_nodes enable row level security;
alter table public.academy_stage_ui_config enable row level security;

drop policy if exists "content_items org read" on public.content_items;
create policy "content_items org read" on public.content_items for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "content_items admin write" on public.content_items;
create policy "content_items admin write" on public.content_items for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists "academy_stage_nodes org read" on public.academy_stage_nodes;
create policy "academy_stage_nodes org read" on public.academy_stage_nodes for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "academy_stage_nodes admin write" on public.academy_stage_nodes;
create policy "academy_stage_nodes admin write" on public.academy_stage_nodes for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists "academy_stage_ui_config org read" on public.academy_stage_ui_config;
create policy "academy_stage_ui_config org read" on public.academy_stage_ui_config for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "academy_stage_ui_config admin write" on public.academy_stage_ui_config;
create policy "academy_stage_ui_config admin write" on public.academy_stage_ui_config for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop trigger if exists content_items_domain_event on public.content_items;
create trigger content_items_domain_event after insert or update or delete on public.content_items
for each row execute function public.capture_domain_event();

drop trigger if exists academy_stage_nodes_domain_event on public.academy_stage_nodes;
create trigger academy_stage_nodes_domain_event after insert or update or delete on public.academy_stage_nodes
for each row execute function public.capture_domain_event();

drop trigger if exists academy_stage_ui_config_domain_event on public.academy_stage_ui_config;
create trigger academy_stage_ui_config_domain_event after insert or update or delete on public.academy_stage_ui_config
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   drop trigger if exists academy_stage_ui_config_domain_event on public.academy_stage_ui_config;
--   drop trigger if exists academy_stage_nodes_domain_event on public.academy_stage_nodes;
--   drop trigger if exists content_items_domain_event on public.content_items;
--   drop table if exists public.academy_stage_ui_config;
--   alter table public.career_stage_resources drop constraint if exists career_stage_resources_surface_check;
--   alter table public.career_stage_resources drop column if exists is_featured;
--   alter table public.career_stage_resources drop column if exists surface;
--   alter table public.career_stage_resources drop column if exists node_id;
--   drop trigger if exists trg_h2obook_validate_stage_node_depth on public.academy_stage_nodes;
--   drop function if exists public.h2obook_validate_stage_node_depth();
--   drop table if exists public.academy_stage_nodes;
--   drop function if exists public.h2obook_sync_content_catalog(uuid);
--   drop table if exists public.content_items;
-- career_stage_programs and career_stage_resources.program_id are untouched by this migration, so
-- rolling back leaves the pre-0041 state exactly as 0040 left it.
