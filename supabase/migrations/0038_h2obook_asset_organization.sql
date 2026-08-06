-- H2OBOOK Module 0038 — Asset Organization
--
-- Additive only. No new tables: 0037 already created asset_folders, asset_tags, asset_tag_links and
-- asset_saved_views, and assets already carries folder_id. Full gap analysis in
-- docs/module-0038-asset-organization-audit.md.
--
-- Also fixes a real defect in 0037. It declared
--   unique(organization_id, parent_id, name)
-- on asset_folders. Postgres treats two NULLs as distinct in a unique constraint, and a root folder
-- has parent_id NULL — so two root folders could share a name, and root is exactly where folders
-- are created most. Only child folders were ever protected. Replaced below with two partial unique
-- indexes on slug, the second of which omits parent_id from the key entirely.

begin;

-- ---------------------------------------------------------------------------
-- Folders: slug, archive.
-- ---------------------------------------------------------------------------
alter table public.asset_folders
  add column if not exists slug text,
  add column if not exists archived_at timestamptz;

-- Backfill before the unique indexes go on, so a library that already has folders does not make the
-- migration fail. Vietnamese names lose their diacritics rather than their meaning: "Ảnh cô dâu"
-- becomes "anh-co-dau", which is still recognisable in a URL.
update public.asset_folders
set slug = nullif(trim(both '-' from regexp_replace(lower(translate(name,
  'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')), '[^a-z0-9]+', '-', 'g')), '')
where slug is null;

update public.asset_folders set slug = 'thu-muc' where slug is null or slug = '';

-- If duplicates already exist because of the 0037 defect, keep the oldest and suffix the rest
-- rather than letting the index creation below fail.
with ranked as (
  select id, slug, row_number() over (partition by organization_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug order by created_at) as rn
  from public.asset_folders
)
update public.asset_folders f
set slug = f.slug || '-' || ranked.rn
from ranked
where f.id = ranked.id and ranked.rn > 1;

alter table public.asset_folders alter column slug set not null;

alter table public.asset_folders drop constraint if exists asset_folders_organization_id_parent_id_name_key;
create unique index if not exists asset_folders_child_slug_idx on public.asset_folders(organization_id, parent_id, slug) where parent_id is not null;
create unique index if not exists asset_folders_root_slug_idx on public.asset_folders(organization_id, slug) where parent_id is null;
create index if not exists asset_folders_active_idx on public.asset_folders(organization_id, position) where archived_at is null;

-- ---------------------------------------------------------------------------
-- Tags: slug, archive.
-- ---------------------------------------------------------------------------
alter table public.asset_tags
  add column if not exists slug text,
  add column if not exists archived_at timestamptz;

update public.asset_tags
set slug = nullif(trim(both '-' from regexp_replace(lower(translate(name,
  'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')), '[^a-z0-9]+', '-', 'g')), '')
where slug is null;

update public.asset_tags set slug = 'the' where slug is null or slug = '';

with ranked as (
  select id, row_number() over (partition by organization_id, slug order by created_at) as rn
  from public.asset_tags
)
update public.asset_tags t
set slug = t.slug || '-' || ranked.rn
from ranked
where t.id = ranked.id and ranked.rn > 1;

alter table public.asset_tags alter column slug set not null;
create unique index if not exists asset_tags_slug_idx on public.asset_tags(organization_id, slug);

-- ---------------------------------------------------------------------------
-- Saved views: what to show, not only what to match.
-- Kept as real columns rather than more keys inside `filters`, because the API validates filters
-- against a known list and would have to special-case anything hidden in there that is not a filter.
-- ---------------------------------------------------------------------------
alter table public.asset_saved_views
  add column if not exists sort_by text not null default 'created_at',
  add column if not exists sort_direction text not null default 'desc' check (sort_direction in ('asc','desc')),
  add column if not exists view_mode text not null default 'table' check (view_mode in ('table','grid')),
  add column if not exists visible_columns text[] not null default '{}';

comment on table public.asset_saved_views is
  'Stores the query, never the result. A view re-runs its filters on every open, so an asset uploaded after the view was saved appears in it without anyone touching the view.';

-- ---------------------------------------------------------------------------
-- Audit. 0037 wired assets and asset_folders; the other three were missed.
-- ---------------------------------------------------------------------------
drop trigger if exists asset_tags_domain_event on public.asset_tags;
create trigger asset_tags_domain_event after insert or update or delete on public.asset_tags
for each row execute function public.capture_domain_event();

drop trigger if exists asset_tag_links_domain_event on public.asset_tag_links;
create trigger asset_tag_links_domain_event after insert or update or delete on public.asset_tag_links
for each row execute function public.capture_domain_event();

drop trigger if exists asset_saved_views_domain_event on public.asset_saved_views;
create trigger asset_saved_views_domain_event after insert or update or delete on public.asset_saved_views
for each row execute function public.capture_domain_event();

commit;

-- Rollback: see docs/module-0038-asset-organization-rollback.md.
