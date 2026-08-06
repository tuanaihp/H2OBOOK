-- H2OBOOK Asset Governance V1
--
-- Adapted from v5/19-h2obook_asset_governance_v1. Full reasoning in
-- docs/asset-governance-integration-audit.md; the short version:
--
-- The source migration opens with `create table if not exists public.media_assets`. No such table
-- exists here — the asset table is public.assets (0001), and 22 foreign keys across ten migrations
-- point at it. `if not exists` would not have errored; it would have quietly created a second,
-- empty asset table while every real row and every foreign key stayed on the first, and the new
-- governance screen would have been reading the empty one. The module's own README forbids exactly
-- this ("Không tạo bảng media_assets song song nếu đã tồn tại") — it exists, under another name.
-- So: assets keeps being the source of truth and gains the missing metadata as columns.
--
-- Seven of the eleven proposed tables are dropped as duplicates:
--   asset_audit_logs                      -> domain_events (0007) + capture_domain_event()
--   asset_upload_batches/_items           -> input_sessions, input_session_events, ingestion_runs
--   asset_stage_links, asset_resource_links -> career_stage_resources (0033), which already maps a
--                                            stage to a resource by resource_type + resource_id and
--                                            is what the access engine reads; a second mapping would
--                                            re-fragment what 0033/0034 just unified
--   media_assets                          -> assets
--   asset_versions                        -> deferred, not duplicated: asset_variants (0008) is
--                                            renditions, not versions, so this is a real gap, just
--                                            not part of "classify and find" which is the V1 problem
--
-- Four are genuinely new and land as-is: folders, tags, tag links, saved views.

begin;

-- ---------------------------------------------------------------------------
-- Folders first: assets references it.
-- ---------------------------------------------------------------------------
create table if not exists public.asset_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid references public.asset_folders(id) on delete cascade,
  name text not null,
  description text not null default '',
  position integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, parent_id, name)
);

create table if not exists public.asset_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique(organization_id, name)
);

create table if not exists public.asset_tag_links (
  asset_id uuid not null references public.assets(id) on delete cascade,
  tag_id uuid not null references public.asset_tags(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(asset_id, tag_id)
);

-- A saved view is a stored filter, not stored results — the query is re-run each time, so a view
-- never goes stale as assets are added.
create table if not exists public.asset_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, name)
);

-- ---------------------------------------------------------------------------
-- Governance metadata on the real asset table.
-- Every column is additive with a default that reproduces today's behaviour: an existing row reads
-- as unclassified, unreviewed and active, which is exactly what it is.
-- ---------------------------------------------------------------------------
alter table public.assets
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists asset_subtype text,
  add column if not exists folder_id uuid references public.asset_folders(id) on delete set null,
  add column if not exists owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewer_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists classification_status text not null default 'unclassified'
    check (classification_status in ('unclassified','classified','needs_review')),
  add column if not exists review_status text not null default 'not_required'
    check (review_status in ('not_required','pending','approved','rejected')),
  add column if not exists lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active','archived','retired')),
  add column if not exists language_code text,
  add column if not exists rights_status text not null default 'unknown'
    check (rights_status in ('unknown','owned','licensed','restricted')),
  add column if not exists rights_expires_at timestamptz,
  add column if not exists source_origin text,
  add column if not exists page_count integer,
  add column if not exists duration_seconds numeric(10,2);

comment on column public.assets.title is
  'Display name, separate from original_name. A file called IMG_4821.jpg is not a name anyone can search for, which is the whole problem this column exists to fix.';

create index if not exists assets_org_classification_idx on public.assets(organization_id, classification_status) where deleted_at is null;
create index if not exists assets_folder_idx on public.assets(folder_id) where deleted_at is null;
create index if not exists asset_tag_links_tag_idx on public.asset_tag_links(tag_id);

-- ---------------------------------------------------------------------------
-- RLS. Same shape as every other org-scoped table here: members read, admins write.
-- ---------------------------------------------------------------------------
alter table public.asset_folders enable row level security;
alter table public.asset_tags enable row level security;
alter table public.asset_tag_links enable row level security;
alter table public.asset_saved_views enable row level security;

create policy "asset folders member read" on public.asset_folders for select to authenticated
using (public.is_org_member(organization_id));
create policy "asset folders admin write" on public.asset_folders for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]));

create policy "asset tags member read" on public.asset_tags for select to authenticated
using (public.is_org_member(organization_id));
create policy "asset tags admin write" on public.asset_tags for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]));

create policy "asset tag links member read" on public.asset_tag_links for select to authenticated
using (public.is_org_member(organization_id));
create policy "asset tag links admin write" on public.asset_tag_links for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]));

-- A private saved view belongs to whoever made it; a shared one is visible to the workspace.
create policy "asset saved views read" on public.asset_saved_views for select to authenticated
using (public.is_org_member(organization_id) and (is_shared or created_by = auth.uid()));
create policy "asset saved views write" on public.asset_saved_views for all to authenticated
using (public.is_org_member(organization_id) and created_by = auth.uid())
with check (public.is_org_member(organization_id) and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Audit. Replaces the proposed asset_audit_logs table with the mechanism already in use.
-- ---------------------------------------------------------------------------
create trigger assets_domain_event after insert or update or delete on public.assets
for each row execute function public.capture_domain_event();

create trigger asset_folders_domain_event after insert or update or delete on public.asset_folders
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   drop trigger if exists assets_domain_event on public.assets;
--   drop trigger if exists asset_folders_domain_event on public.asset_folders;
--   drop table if exists public.asset_saved_views, public.asset_tag_links, public.asset_tags, public.asset_folders;
--   alter table public.assets
--     drop column if exists title, drop column if exists description, drop column if exists asset_subtype,
--     drop column if exists folder_id, drop column if exists owner_user_id, drop column if exists reviewer_user_id,
--     drop column if exists classification_status, drop column if exists review_status,
--     drop column if exists lifecycle_status, drop column if exists language_code,
--     drop column if exists rights_status, drop column if exists rights_expires_at,
--     drop column if exists source_origin, drop column if exists page_count, drop column if exists duration_seconds;
-- Additive throughout, so dropping restores the prior state exactly.
