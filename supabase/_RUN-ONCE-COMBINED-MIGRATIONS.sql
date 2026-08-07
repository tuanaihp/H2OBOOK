-- H2OBOOK — toan bo migration gop san, dung thu tu. Chay 1 lan tren Supabase SQL Editor.

-- ===== 0001_h2obook_core.sql =====
-- H2OBOOK V1 core schema
-- Run in Supabase SQL editor or via `supabase db push`.
create extension if not exists "pgcrypto";

create type public.member_role as enum ('owner','admin','designer','partner','teacher','student');
create type public.book_status as enum ('draft','published','archived');
create type public.template_visibility as enum ('private','workspace','marketplace');
create type public.entitlement_status as enum ('active','expired','revoked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  owner_id uuid not null references public.profiles(id),
  plan_code text not null default 'creator',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(organization_id,user_id)
);

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  expert_name text not null default '',
  expert_title text not null default '',
  primary_color text not null default '#6f1d46',
  secondary_color text not null default '#f6e9ee',
  accent_color text not null default '#d4a055',
  heading_font text not null default 'Georgia',
  body_font text not null default 'Arial',
  logo_asset_id uuid,
  avatar_asset_id uuid,
  contact jsonb not null default '{}'::jsonb,
  variables jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  asset_type text not null,
  original_name text not null,
  storage_key text not null unique,
  mime_type text not null,
  size_bytes bigint not null default 0,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);

alter table public.brand_profiles add constraint brand_logo_asset_fk foreign key (logo_asset_id) references public.assets(id) on delete set null;
alter table public.brand_profiles add constraint brand_avatar_asset_fk foreign key (avatar_asset_id) references public.assets(id) on delete set null;

create table public.books (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  title text not null,
  slug text not null,
  subtitle text not null default '',
  description text not null default '',
  author text not null default '',
  status public.book_status not null default 'draft',
  cover jsonb not null default '{}'::jsonb,
  page_width integer not null default 794,
  page_height integer not null default 1123,
  current_version integer not null default 1,
  default_brand_profile_id uuid references public.brand_profiles(id),
  source_template_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug)
);

create table public.book_versions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  version_number integer not null,
  change_note text not null default '',
  snapshot jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(book_id,version_number)
);

create table public.book_pages (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  name text not null,
  position integer not null,
  width integer not null default 794,
  height integer not null default 1123,
  background jsonb not null default '{"type":"color","value":"#ffffff"}'::jsonb,
  thumbnail_asset_id uuid references public.assets(id),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id,position)
);

create table public.page_elements (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.book_pages(id) on delete cascade,
  element_type text not null,
  name text not null,
  position_index integer not null,
  transform jsonb not null,
  content jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  binding jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{"canEditContent":true,"canMove":true,"canResize":true,"canDelete":true,"canChangeColor":true}'::jsonb,
  locked boolean not null default false,
  hidden boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_id,position_index)
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_book_id uuid not null references public.books(id) on delete cascade,
  name text not null,
  slug text not null,
  category text not null default 'education',
  visibility public.template_visibility not null default 'private',
  clone_mode text not null default 'linked' check (clone_mode in ('linked','independent')),
  version_number integer not null default 1,
  price_vnd bigint not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug)
);

alter table public.books add constraint books_source_template_fk foreign key (source_template_id) references public.templates(id) on delete set null;

create table public.book_clones (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id),
  source_book_id uuid not null references public.books(id),
  target_book_id uuid not null references public.books(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_profile_id uuid not null references public.brand_profiles(id),
  clone_mode text not null check (clone_mode in ('linked','independent')),
  source_version integer not null,
  last_synced_version integer not null,
  status text not null default 'ready',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(target_book_id)
);

create table public.clone_overrides (
  id uuid primary key default gen_random_uuid(),
  book_clone_id uuid not null references public.book_clones(id) on delete cascade,
  source_element_id uuid not null,
  target_element_id uuid not null,
  override_type text not null,
  override_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(book_clone_id,source_element_id)
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null unique,
  access_type text not null default 'private' check (access_type in ('public','private','paid','membership')),
  download_allowed boolean not null default false,
  watermark_enabled boolean not null default true,
  status text not null default 'published',
  published_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  permission text not null,
  source_type text not null,
  source_id uuid,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  status public.entitlement_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_page_id uuid references public.book_pages(id),
  progress_percent numeric(5,2) not null default 0,
  last_read_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(publication_id,user_id)
);

create table public.reader_notes (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  page_id uuid not null references public.book_pages(id) on delete cascade,
  selection jsonb,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  source_asset_id uuid references public.assets(id),
  target_book_id uuid references public.books(id) on delete cascade,
  import_mode text not null,
  status text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helper functions
create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=auth.uid() and m.status='active');
$$;
create or replace function public.has_org_role(org_id uuid, allowed public.member_role[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=auth.uid() and m.role=any(allowed) and m.status='active');
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.assets enable row level security;
alter table public.books enable row level security;
alter table public.book_versions enable row level security;
alter table public.book_pages enable row level security;
alter table public.page_elements enable row level security;
alter table public.templates enable row level security;
alter table public.book_clones enable row level security;
alter table public.clone_overrides enable row level security;
alter table public.publications enable row level security;
alter table public.entitlements enable row level security;
alter table public.reading_progress enable row level security;
alter table public.reader_notes enable row level security;
alter table public.import_jobs enable row level security;
alter table public.audit_logs enable row level security;

create policy "profile self read" on public.profiles for select using (id=auth.uid());
create policy "profile self update" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
create policy "org member read" on public.organizations for select using (public.is_org_member(id));
create policy "org owner update" on public.organizations for update using (public.has_org_role(id,array['owner','admin']::public.member_role[]));
create policy "members same org read" on public.organization_members for select using (public.is_org_member(organization_id));
create policy "members admin write" on public.organization_members for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "brands org read" on public.brand_profiles for select using (public.is_org_member(organization_id));
create policy "brands editor write" on public.brand_profiles for all using (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[]));
create policy "assets org read" on public.assets for select using (public.is_org_member(organization_id));
create policy "assets org insert" on public.assets for insert with check (public.is_org_member(organization_id) and uploaded_by=auth.uid());
create policy "books org read" on public.books for select using (public.is_org_member(organization_id));
create policy "books editor write" on public.books for all using (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[]));
create policy "versions via book" on public.book_versions for select using (exists(select 1 from public.books b where b.id=book_id and public.is_org_member(b.organization_id)));
create policy "pages via book read" on public.book_pages for select using (exists(select 1 from public.books b where b.id=book_id and public.is_org_member(b.organization_id)));
create policy "pages via book write" on public.book_pages for all using (exists(select 1 from public.books b where b.id=book_id and public.has_org_role(b.organization_id,array['owner','admin','designer','partner']::public.member_role[]))) with check (exists(select 1 from public.books b where b.id=book_id and public.has_org_role(b.organization_id,array['owner','admin','designer','partner']::public.member_role[])));
create policy "elements via page read" on public.page_elements for select using (exists(select 1 from public.book_pages p join public.books b on b.id=p.book_id where p.id=page_id and public.is_org_member(b.organization_id)));
create policy "elements via page write" on public.page_elements for all using (exists(select 1 from public.book_pages p join public.books b on b.id=p.book_id where p.id=page_id and public.has_org_role(b.organization_id,array['owner','admin','designer','partner']::public.member_role[]))) with check (exists(select 1 from public.book_pages p join public.books b on b.id=p.book_id where p.id=page_id and public.has_org_role(b.organization_id,array['owner','admin','designer','partner']::public.member_role[])));
create policy "templates visible" on public.templates for select using (visibility='marketplace' or public.is_org_member(organization_id));
create policy "templates editor write" on public.templates for all using (public.has_org_role(organization_id,array['owner','admin','designer']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer']::public.member_role[]));
create policy "publications public or member" on public.publications for select using (access_type='public' or public.is_org_member(organization_id) or exists(select 1 from public.entitlements e where e.user_id=auth.uid() and e.resource_type='publication' and e.resource_id=id and e.status='active' and (e.expires_at is null or e.expires_at>now())));
create policy "entitlements self read" on public.entitlements for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "progress self" on public.reading_progress for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "notes self" on public.reader_notes for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "jobs org read" on public.import_jobs for select using (public.is_org_member(organization_id));
create policy "jobs self insert" on public.import_jobs for insert with check (public.is_org_member(organization_id) and user_id=auth.uid());
create policy "audit admin read" on public.audit_logs for select using (organization_id is null or public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

-- Auth profile trigger
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,avatar_url) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'avatar_url'); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create index books_org_idx on public.books(organization_id,updated_at desc);
create index pages_book_idx on public.book_pages(book_id,position);
create index elements_page_idx on public.page_elements(page_id,position_index);
create index entitlements_user_idx on public.entitlements(user_id,status,expires_at);
create index progress_user_idx on public.reading_progress(user_id,last_read_at desc);


-- Transactional workspace bootstrap. Call with supabase.rpc('create_workspace', ...).
create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.organizations(name,slug,owner_id) values(workspace_name,workspace_slug,auth.uid()) returning id into new_org_id;
  insert into public.organization_members(organization_id,user_id,role) values(new_org_id,auth.uid(),'owner');
  return new_org_id;
end; $$;
grant execute on function public.create_workspace(text,text) to authenticated;

create policy "org self bootstrap" on public.organizations for insert with check (owner_id=auth.uid());
create policy "versions editor insert" on public.book_versions for insert with check (exists(select 1 from public.books b where b.id=book_id and public.has_org_role(b.organization_id,array['owner','admin','designer','partner']::public.member_role[])) and created_by=auth.uid());
create policy "clones org read" on public.book_clones for select using (public.is_org_member(organization_id));
create policy "clones partner write" on public.book_clones for all using (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[]) and created_by=auth.uid());
create policy "clone overrides via clone" on public.clone_overrides for all using (exists(select 1 from public.book_clones c where c.id=book_clone_id and public.has_org_role(c.organization_id,array['owner','admin','designer','partner']::public.member_role[]))) with check (exists(select 1 from public.book_clones c where c.id=book_clone_id and public.has_org_role(c.organization_id,array['owner','admin','designer','partner']::public.member_role[])));
create policy "publications editor write" on public.publications for all using (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[]));
create policy "jobs self update" on public.import_jobs for update using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));


-- ===== 0002_h2obook_v2_integrated.sql =====
-- H2OBOOK V2 integrated migration
-- Extends V1 in-place. Run after 0001_h2obook_core.sql.

begin;

alter table public.books add column if not exists slug text;
alter table public.books add column if not exists subtitle text;
alter table public.books add column if not exists category text default 'Chưa phân loại';
alter table public.books add column if not exists tags text[] default '{}';
alter table public.books add column if not exists price numeric(14,2) default 0;
alter table public.books add column if not exists visibility text default 'workspace' check (visibility in ('private','workspace','public'));
alter table public.books add column if not exists reading_minutes integer default 0;
alter table public.books add column if not exists version_number integer default 1;
alter table public.books add column if not exists brand_profile_id uuid references public.brand_profiles(id) on delete set null;
alter table public.books add column if not exists published_at timestamptz;
alter table public.books add column if not exists archived_at timestamptz;
create unique index if not exists books_org_slug_unique on public.books(organization_id,slug) where slug is not null and archived_at is null;

alter table public.book_pages add column if not exists page_type text default 'blank';
alter table public.book_pages add column if not exists chapter text;
alter table public.book_pages add column if not exists presenter_notes text;
alter table public.book_pages add column if not exists hidden boolean default false;
alter table public.book_pages add column if not exists master_page_id uuid references public.book_pages(id) on delete set null;

alter table public.page_elements add column if not exists source_element_id uuid references public.page_elements(id) on delete set null;
alter table public.page_elements add column if not exists source_revision integer default 0;
alter table public.page_elements add column if not exists local_revision integer default 0;
alter table public.page_elements add column if not exists hidden boolean default false;

create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  source_book_version_id uuid references public.book_versions(id) on delete set null,
  version_number integer not null,
  release_note text,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(template_id,version_number)
);

create table if not exists public.template_bindings (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.template_versions(id) on delete cascade,
  page_element_id uuid not null references public.page_elements(id) on delete cascade,
  variable_key text not null,
  binding_type text not null default 'value',
  fallback_value text,
  required boolean not null default false,
  created_at timestamptz not null default now(),
  unique(template_version_id,page_element_id,variable_key)
);

create table if not exists public.template_element_permissions (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.template_versions(id) on delete cascade,
  page_element_id uuid not null references public.page_elements(id) on delete cascade,
  can_edit_content boolean not null default true,
  can_replace_asset boolean not null default true,
  can_change_color boolean not null default true,
  can_change_font boolean not null default true,
  can_move boolean not null default true,
  can_resize boolean not null default true,
  can_rotate boolean not null default true,
  can_delete boolean not null default true,
  created_at timestamptz not null default now(),
  unique(template_version_id,page_element_id)
);

alter table public.book_clones add column if not exists clone_mode text default 'linked' check (clone_mode in ('linked','independent'));
alter table public.book_clones add column if not exists source_version integer default 1;
alter table public.book_clones add column if not exists current_template_version integer default 1;
alter table public.book_clones add column if not exists sync_status text default 'synced' check (sync_status in ('synced','update_available','conflict','syncing','failed'));
alter table public.book_clones add column if not exists last_synced_at timestamptz;
alter table public.book_clones add column if not exists partner_name text;

create table if not exists public.clone_sync_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_clone_id uuid not null references public.book_clones(id) on delete cascade,
  from_template_version integer not null,
  to_template_version integer not null,
  status text not null default 'queued' check (status in ('queued','preview','applying','completed','failed','rolled_back')),
  conflict_count integer not null default 0,
  change_summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.clone_conflicts (
  id uuid primary key default gen_random_uuid(),
  clone_sync_event_id uuid not null references public.clone_sync_events(id) on delete cascade,
  source_page_id uuid references public.book_pages(id) on delete set null,
  source_element_id uuid references public.page_elements(id) on delete set null,
  target_page_id uuid references public.book_pages(id) on delete set null,
  target_element_id uuid references public.page_elements(id) on delete set null,
  conflict_type text not null,
  source_value jsonb,
  target_value jsonb,
  resolution text check (resolution in ('use_source','keep_target','manual','skip')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  page_id uuid not null references public.book_pages(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique(publication_id,user_id,page_id)
);

create table if not exists public.libraries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active' check (status in ('active','hidden','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug)
);

create table if not exists public.library_publications (
  library_id uuid not null references public.libraries(id) on delete cascade,
  publication_id uuid not null references public.publications(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(library_id,publication_id)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  start_date date,
  end_date date,
  status text not null default 'upcoming' check (status in ('upcoming','active','completed','archived')),
  color text default '#6f1d46',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code)
);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'student' check (role in ('teacher','assistant','student')),
  status text not null default 'active' check (status in ('invited','active','paused','completed','removed')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique(class_id,user_id)
);

create table if not exists public.class_books (
  class_id uuid not null references public.classes(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  publication_id uuid references public.publications(id) on delete set null,
  required boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(class_id,book_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  page_id uuid references public.book_pages(id) on delete set null,
  title text not null,
  instructions text,
  due_at timestamptz,
  max_score numeric(8,2) not null default 100,
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  asset_ids uuid[] not null default '{}',
  score numeric(8,2),
  feedback text,
  status text not null default 'draft' check (status in ('draft','submitted','late','graded','returned')),
  submitted_at timestamptz,
  graded_by uuid references public.profiles(id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assignment_id,student_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_name text,
  title text not null,
  passing_score numeric(5,2) not null default 70,
  time_limit_minutes integer not null default 15,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_type text not null check (question_type in ('single','multiple','true_false','short_text')),
  content text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answers jsonb not null default '[]'::jsonb,
  explanation text,
  score numeric(8,2) not null default 1,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score numeric(8,2),
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_type text not null check (product_type in ('book','template','membership','bundle')),
  reference_id uuid,
  name text not null,
  slug text not null,
  description text,
  cover_asset_id uuid references public.assets(id) on delete set null,
  price numeric(14,2) not null default 0,
  compare_at_price numeric(14,2),
  currency text not null default 'VND',
  billing_interval text check (billing_interval in ('month','year')),
  status text not null default 'draft' check (status in ('draft','active','hidden','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_code text not null unique,
  buyer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency text not null default 'VND',
  payment_method text,
  payment_provider text,
  provider_transaction_id text,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','cancelled')),
  order_status text not null default 'created' check (order_status in ('created','processing','fulfilled','cancelled','refunded')),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null,
  total numeric(14,2) not null,
  entitlement_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  plan_name text not null,
  price numeric(14,2) not null default 0,
  currency text not null default 'VND',
  billing_interval text not null check (billing_interval in ('month','year')),
  status text not null default 'trial' check (status in ('trial','active','past_due','cancelled','expired')),
  starts_at timestamptz not null default now(),
  renews_at timestamptz,
  expires_at timestamptz,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'system',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_id text,
  event_name text not null,
  resource_type text,
  resource_id uuid,
  session_id text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists template_versions_template_idx on public.template_versions(template_id,version_number desc);
create index if not exists clone_sync_events_clone_idx on public.clone_sync_events(book_clone_id,created_at desc);
create index if not exists class_members_user_idx on public.class_members(user_id,status);
create index if not exists assignments_class_idx on public.assignments(class_id,due_at);
create index if not exists submissions_student_idx on public.assignment_submissions(student_id,status);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id,started_at desc);
create index if not exists orders_org_created_idx on public.orders(organization_id,created_at desc);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists memberships_user_status_idx on public.memberships(user_id,status);
create index if not exists notifications_user_read_idx on public.notifications(user_id,read_at,created_at desc);
create index if not exists analytics_org_event_time_idx on public.analytics_events(organization_id,event_name,occurred_at desc);

alter table public.template_versions enable row level security;
alter table public.template_bindings enable row level security;
alter table public.template_element_permissions enable row level security;
alter table public.clone_sync_events enable row level security;
alter table public.clone_conflicts enable row level security;
alter table public.bookmarks enable row level security;
alter table public.libraries enable row level security;
alter table public.library_publications enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_books enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.memberships enable row level security;
alter table public.notifications enable row level security;
alter table public.analytics_events enable row level security;

create policy "template versions visible" on public.template_versions for select using (
  exists(select 1 from public.templates t where t.id=template_id and (t.visibility='marketplace' or public.is_org_member(t.organization_id)))
);
create policy "template versions editor write" on public.template_versions for all using (
  exists(select 1 from public.templates t where t.id=template_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
) with check (
  exists(select 1 from public.templates t where t.id=template_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
);
create policy "template bindings visible" on public.template_bindings for select using (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and (t.visibility='marketplace' or public.is_org_member(t.organization_id)))
);
create policy "template bindings editor write" on public.template_bindings for all using (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
) with check (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
);
create policy "template permissions visible" on public.template_element_permissions for select using (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and (t.visibility='marketplace' or public.is_org_member(t.organization_id)))
);
create policy "template permissions editor write" on public.template_element_permissions for all using (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
) with check (
  exists(select 1 from public.template_versions tv join public.templates t on t.id=tv.template_id where tv.id=template_version_id and public.has_org_role(t.organization_id,array['owner','admin','designer']::public.member_role[]))
);
create policy "clone sync org read" on public.clone_sync_events for select using (public.is_org_member(organization_id));
create policy "clone sync editor write" on public.clone_sync_events for all using (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','partner']::public.member_role[]));
create policy "clone conflicts via event" on public.clone_conflicts for all using (
  exists(select 1 from public.clone_sync_events e where e.id=clone_sync_event_id and public.has_org_role(e.organization_id,array['owner','admin','designer','partner']::public.member_role[]))
) with check (
  exists(select 1 from public.clone_sync_events e where e.id=clone_sync_event_id and public.has_org_role(e.organization_id,array['owner','admin','designer','partner']::public.member_role[]))
);
create policy "bookmarks self" on public.bookmarks for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "libraries org read" on public.libraries for select using (public.is_org_member(organization_id));
create policy "libraries admin write" on public.libraries for all using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "library publications via library" on public.library_publications for all using (exists(select 1 from public.libraries l where l.id=library_id and public.is_org_member(l.organization_id))) with check (exists(select 1 from public.libraries l where l.id=library_id and public.has_org_role(l.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "classes org read" on public.classes for select using (public.is_org_member(organization_id) or exists(select 1 from public.class_members cm where cm.class_id=id and cm.user_id=auth.uid() and cm.status in ('active','completed')));
create policy "classes teacher write" on public.classes for all using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "class members scoped read" on public.class_members for select using (user_id=auth.uid() or exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "class members teacher write" on public.class_members for all using (exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[]))) with check (exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "class books scoped" on public.class_books for select using (exists(select 1 from public.classes c where c.id=class_id and (public.is_org_member(c.organization_id) or exists(select 1 from public.class_members cm where cm.class_id=c.id and cm.user_id=auth.uid() and cm.status='active'))));
create policy "class books teacher write" on public.class_books for all using (exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[]))) with check (exists(select 1 from public.classes c where c.id=class_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "assignments class read" on public.assignments for select using (public.is_org_member(organization_id) or exists(select 1 from public.class_members cm where cm.class_id=class_id and cm.user_id=auth.uid() and cm.status='active'));
create policy "assignments teacher write" on public.assignments for all using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "submissions student read" on public.assignment_submissions for select using (student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and public.has_org_role(a.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "submissions student insert" on public.assignment_submissions for insert with check (student_id=auth.uid());
create policy "submissions teacher update" on public.assignment_submissions for update using (student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and public.has_org_role(a.organization_id,array['owner','admin','teacher']::public.member_role[]))) with check (student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and public.has_org_role(a.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "quizzes scoped read" on public.quizzes for select using (public.is_org_member(organization_id) or exists(select 1 from public.entitlements e where e.user_id=auth.uid() and e.resource_type='book' and e.resource_id=book_id and e.status='active'));
create policy "quizzes teacher write" on public.quizzes for all using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "quiz questions via quiz" on public.quiz_questions for select using (exists(select 1 from public.quizzes q where q.id=quiz_id and (public.is_org_member(q.organization_id) or exists(select 1 from public.entitlements e where e.user_id=auth.uid() and e.resource_type='book' and e.resource_id=q.book_id and e.status='active'))));
create policy "quiz questions teacher write" on public.quiz_questions for all using (exists(select 1 from public.quizzes q where q.id=quiz_id and public.has_org_role(q.organization_id,array['owner','admin','teacher']::public.member_role[]))) with check (exists(select 1 from public.quizzes q where q.id=quiz_id and public.has_org_role(q.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "quiz attempts self" on public.quiz_attempts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "products public read" on public.products for select using (status='active' or public.is_org_member(organization_id));
create policy "products admin write" on public.products for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "orders buyer or admin read" on public.orders for select using (buyer_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "orders admin write" on public.orders for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "order items via order" on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and (o.buyer_id=auth.uid() or public.has_org_role(o.organization_id,array['owner','admin']::public.member_role[]))));
create policy "order items admin write" on public.order_items for all using (exists(select 1 from public.orders o where o.id=order_id and public.has_org_role(o.organization_id,array['owner','admin']::public.member_role[]))) with check (exists(select 1 from public.orders o where o.id=order_id and public.has_org_role(o.organization_id,array['owner','admin']::public.member_role[])));
create policy "memberships self or admin read" on public.memberships for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "memberships admin write" on public.memberships for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "notifications self" on public.notifications for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "analytics insert" on public.analytics_events for insert with check (organization_id is null or public.is_org_member(organization_id) or auth.uid() is null);
create policy "analytics admin read" on public.analytics_events for select using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create or replace function public.mark_order_paid(p_order_id uuid, p_transaction_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_expiry timestamptz;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status='paid' then return; end if;
  update public.orders set payment_status='paid',order_status='fulfilled',provider_transaction_id=coalesce(p_transaction_id,provider_transaction_id),paid_at=now(),updated_at=now() where id=p_order_id;
  if v_order.buyer_id is null then return; end if;
  for v_item in select oi.*,p.product_type,p.reference_id,p.billing_interval from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=p_order_id loop
    v_expiry := case when v_item.billing_interval='month' then now()+interval '1 month' when v_item.billing_interval='year' then now()+interval '1 year' else null end;
    insert into public.entitlements(user_id,organization_id,resource_type,resource_id,permission,source_type,source_id,starts_at,expires_at,status)
    values(v_order.buyer_id,v_order.organization_id,v_item.product_type,v_item.reference_id,'access','order',p_order_id,now(),v_expiry,'active')
    on conflict do nothing;
  end loop;
end;
$$;

commit;


-- ===== 0003_h2obook_v3_integrated.sql =====
-- H2OBOOK V3 integrated migration
-- Extends the same V1/V2 database. Run after 0001 and 0002.

begin;

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  title text not null,
  stage text not null default 'content' check (stage in ('content','design','brand','legal','final')),
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','approved','published')),
  requested_by uuid references public.profiles(id) on delete set null,
  assignee_ids uuid[] not null default '{}',
  due_at timestamptz,
  checklist jsonb not null default '[]'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_id uuid not null references public.review_requests(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page_id uuid references public.book_pages(id) on delete set null,
  element_id uuid references public.page_elements(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  message text not null,
  resolved boolean not null default false,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.collaboration_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  session_key text not null,
  locked_page_ids uuid[] not null default '{}',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id,session_key)
);

create table if not exists public.collaboration_presence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.collaboration_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  page_id uuid references public.book_pages(id) on delete set null,
  cursor_json jsonb not null default '{}'::jsonb,
  status text not null default 'online' check (status in ('online','idle','offline')),
  last_seen_at timestamptz not null default now(),
  unique(session_id,user_id)
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  job_type text not null check (job_type in ('outline','rewrite','quiz','summary','brand_copy','translate','accessibility')),
  prompt text not null,
  output text,
  provider text not null default 'gateway',
  provider_job_id text,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  usage_json jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  trigger_event text not null,
  actions jsonb not null default '[]'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','paused','archived')),
  run_count integer not null default 0,
  error_count integer not null default 0,
  last_run_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  event_name text not null,
  event_payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','skipped')),
  action_results jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.license_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete restrict,
  licensee_organization_id uuid references public.organizations(id) on delete set null,
  licensee_name text not null,
  license_model text not null check (license_model in ('one_time','subscription','revenue_share')),
  price numeric(14,2) not null default 0,
  revenue_share_percent numeric(5,2) not null default 0 check (revenue_share_percent between 0 and 100),
  seat_limit integer not null default 1,
  clone_limit integer not null default 1,
  clones_used integer not null default 0,
  status text not null default 'draft' check (status in ('draft','active','expired','suspended')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  terms_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.royalty_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  license_id uuid not null references public.license_agreements(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_revenue numeric(14,2) not null default 0,
  rate numeric(5,2) not null default 0,
  amount numeric(14,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(license_id,period_start,period_end)
);

create table if not exists public.white_label_portals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  custom_domain text,
  logo_asset_id uuid references public.assets(id) on delete set null,
  primary_color text not null default '#6f1d46',
  accent_color text not null default '#e8a8c3',
  theme text not null default 'light' check (theme in ('light','dark','system')),
  status text not null default 'draft' check (status in ('draft','active','maintenance')),
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug),
  unique(custom_domain)
);

create table if not exists public.white_label_portal_books (
  portal_id uuid not null references public.white_label_portals(id) on delete cascade,
  publication_id uuid not null references public.publications(id) on delete cascade,
  position integer not null default 0,
  featured boolean not null default false,
  primary key(portal_id,publication_id)
);

create table if not exists public.content_health_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  book_version_id uuid references public.book_versions(id) on delete set null,
  score integer not null check (score between 0 and 100),
  readability integer not null check (readability between 0 and 100),
  accessibility integer not null check (accessibility between 0 and 100),
  brand_consistency integer not null check (brand_consistency between 0 and 100),
  image_quality integer not null check (image_quality between 0 and 100),
  broken_links integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  scan_metadata jsonb not null default '{}'::jsonb,
  scanned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists review_requests_org_status_idx on public.review_requests(organization_id,status,updated_at desc);
create index if not exists review_requests_book_idx on public.review_requests(book_id,created_at desc);
create index if not exists review_comments_review_idx on public.review_comments(review_id,resolved,created_at desc);
create index if not exists collaboration_sessions_book_idx on public.collaboration_sessions(book_id,updated_at desc);
create index if not exists collaboration_presence_session_idx on public.collaboration_presence(session_id,status,last_seen_at desc);
create index if not exists ai_jobs_org_status_idx on public.ai_jobs(organization_id,status,created_at desc);
create index if not exists automation_rules_org_status_idx on public.automation_rules(organization_id,status);
create index if not exists automation_runs_rule_idx on public.automation_runs(rule_id,started_at desc);
create index if not exists license_agreements_org_status_idx on public.license_agreements(organization_id,status);
create index if not exists royalty_payouts_license_idx on public.royalty_payouts(license_id,status,period_end desc);
create index if not exists white_label_portals_org_idx on public.white_label_portals(organization_id,status);
create index if not exists content_health_book_idx on public.content_health_reports(book_id,created_at desc);

alter table public.review_requests enable row level security;
alter table public.review_comments enable row level security;
alter table public.collaboration_sessions enable row level security;
alter table public.collaboration_presence enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;
alter table public.license_agreements enable row level security;
alter table public.royalty_payouts enable row level security;
alter table public.white_label_portals enable row level security;
alter table public.white_label_portal_books enable row level security;
alter table public.content_health_reports enable row level security;

create policy "reviews org read" on public.review_requests for select using (public.is_org_member(organization_id));
create policy "reviews editor write" on public.review_requests for all using (public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[]));
create policy "review comments org read" on public.review_comments for select using (public.is_org_member(organization_id));
create policy "review comments org insert" on public.review_comments for insert with check (public.is_org_member(organization_id) and (author_id is null or author_id=auth.uid()));
create policy "review comments author or reviewer update" on public.review_comments for update using (author_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check (public.is_org_member(organization_id));

create policy "collaboration sessions org" on public.collaboration_sessions for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "collaboration presence via session" on public.collaboration_presence for all using (exists(select 1 from public.collaboration_sessions s where s.id=session_id and public.is_org_member(s.organization_id))) with check (user_id=auth.uid() and exists(select 1 from public.collaboration_sessions s where s.id=session_id and public.is_org_member(s.organization_id)));

create policy "ai jobs org read" on public.ai_jobs for select using (public.is_org_member(organization_id));
create policy "ai jobs org insert" on public.ai_jobs for insert with check (public.is_org_member(organization_id) and (requested_by is null or requested_by=auth.uid()));
create policy "ai jobs admin update" on public.ai_jobs for update using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.is_org_member(organization_id));

create policy "automation rules admin" on public.automation_rules for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "automation runs admin read" on public.automation_runs for select using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "automation runs service insert" on public.automation_runs for insert with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "licenses org read" on public.license_agreements for select using (public.is_org_member(organization_id) or licensee_organization_id in (select organization_id from public.organization_members where user_id=auth.uid() and status='active'));
create policy "licenses owner admin write" on public.license_agreements for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "royalties owner admin" on public.royalty_payouts for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "portals public read active" on public.white_label_portals for select using (status='active' or public.is_org_member(organization_id));
create policy "portals admin write" on public.white_label_portals for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "portal books public read" on public.white_label_portal_books for select using (exists(select 1 from public.white_label_portals p where p.id=portal_id and (p.status='active' or public.is_org_member(p.organization_id))));
create policy "portal books admin write" on public.white_label_portal_books for all using (exists(select 1 from public.white_label_portals p where p.id=portal_id and public.has_org_role(p.organization_id,array['owner','admin']::public.member_role[]))) with check (exists(select 1 from public.white_label_portals p where p.id=portal_id and public.has_org_role(p.organization_id,array['owner','admin']::public.member_role[])));

create policy "health reports org read" on public.content_health_reports for select using (public.is_org_member(organization_id));
create policy "health reports editor write" on public.content_health_reports for all using (public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[]));

create or replace function public.approve_review(p_review_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_review public.review_requests%rowtype;
begin
  select * into v_review from public.review_requests where id=p_review_id for update;
  if not found then raise exception 'Review not found'; end if;
  if not public.has_org_role(v_review.organization_id,array['owner','admin','designer','teacher']::public.member_role[]) then raise exception 'Forbidden'; end if;
  update public.review_requests set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_review_id;
end;
$$;

create or replace function public.mark_royalty_paid(p_payout_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_payout public.royalty_payouts%rowtype;
begin
  select * into v_payout from public.royalty_payouts where id=p_payout_id for update;
  if not found then raise exception 'Payout not found'; end if;
  if not public.has_org_role(v_payout.organization_id,array['owner','admin']::public.member_role[]) then raise exception 'Forbidden'; end if;
  update public.royalty_payouts set status='paid',paid_at=now() where id=p_payout_id;
end;
$$;

commit;


-- ===== 0004_h2obook_production_core.sql =====
begin;

create table if not exists public.workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  client_version bigint not null,
  payload jsonb not null,
  checksum text,
  created_at timestamptz not null default now()
);

create table if not exists public.document_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  job_type text not null check (job_type in ('pdf_import','docx_import','ocr','thumbnail','pdf_export','health_scan')),
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_message text,
  external_job_id text,
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.document_jobs(id) on delete cascade,
  event_type text not null,
  message text,
  progress integer check (progress between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_transaction_id text,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_hash text not null,
  device_name text,
  last_ip inet,
  last_user_agent text,
  trusted boolean not null default false,
  revoked_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(user_id,device_hash)
);

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_snapshots_org_created_idx on public.workspace_snapshots(organization_id,created_at desc);
create index if not exists document_jobs_org_status_idx on public.document_jobs(organization_id,status,created_at desc);
create index if not exists document_job_events_job_idx on public.document_job_events(job_id,created_at);
create index if not exists payment_events_tx_idx on public.payment_events(provider_transaction_id,created_at desc);
create index if not exists user_devices_user_idx on public.user_devices(user_id,last_seen_at desc);
create index if not exists security_events_org_idx on public.security_events(organization_id,severity,created_at desc);

alter table public.workspace_snapshots enable row level security;
alter table public.document_jobs enable row level security;
alter table public.document_job_events enable row level security;
alter table public.payment_events enable row level security;
alter table public.user_devices enable row level security;
alter table public.security_events enable row level security;

create policy "snapshots org read" on public.workspace_snapshots for select using (public.is_org_member(organization_id));
create policy "snapshots org insert" on public.workspace_snapshots for insert with check (public.is_org_member(organization_id) and (created_by is null or created_by=auth.uid()));
create policy "snapshots admin delete" on public.workspace_snapshots for delete using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "document jobs org read" on public.document_jobs for select using (public.is_org_member(organization_id));
create policy "document jobs member insert" on public.document_jobs for insert with check (public.is_org_member(organization_id) and (requested_by is null or requested_by=auth.uid()));
create policy "document jobs editor update" on public.document_jobs for update using (public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check (public.is_org_member(organization_id));
create policy "job events org read" on public.document_job_events for select using (exists(select 1 from public.document_jobs j where j.id=job_id and public.is_org_member(j.organization_id)));

create policy "payment events admin read" on public.payment_events for select using (exists(select 1 from public.orders o where o.provider_transaction_id=payment_events.provider_transaction_id and public.has_org_role(o.organization_id,array['owner','admin']::public.member_role[])));
create policy "devices own read" on public.user_devices for select using (user_id=auth.uid());
create policy "devices own update" on public.user_devices for update using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "security events admin read" on public.security_events for select using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create or replace function public.revoke_expired_entitlements()
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  update public.entitlements set status='expired'
  where status='active' and expires_at is not null and expires_at<=now();
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function public.prune_workspace_snapshots(p_organization_id uuid, p_keep integer default 30)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if not public.has_org_role(p_organization_id,array['owner','admin']::public.member_role[]) then raise exception 'Forbidden'; end if;
  with doomed as (
    select id from public.workspace_snapshots where organization_id=p_organization_id
    order by created_at desc offset greatest(p_keep,1)
  ) delete from public.workspace_snapshots where id in (select id from doomed);
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

commit;


-- ===== 0005_h2obook_security_hardening.sql =====
begin;

drop policy if exists "snapshots org read" on public.workspace_snapshots;
drop policy if exists "snapshots org insert" on public.workspace_snapshots;
drop policy if exists "snapshots admin delete" on public.workspace_snapshots;
create policy "snapshots admin read" on public.workspace_snapshots for select using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "snapshots admin insert" on public.workspace_snapshots for insert with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]) and created_by=auth.uid());
create policy "snapshots admin delete" on public.workspace_snapshots for delete using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create unique index if not exists entitlements_active_source_unique
on public.entitlements(user_id,resource_type,resource_id,source_type,source_id)
where status='active';

create index if not exists entitlements_user_active_idx on public.entitlements(user_id,status,expires_at);
create index if not exists orders_provider_transaction_idx on public.orders(payment_provider,provider_transaction_id);
create index if not exists publications_access_idx on public.publications(status,access_type,published_at desc);

alter table public.books add column if not exists client_key text;
alter table public.book_pages add column if not exists client_key text;
alter table public.book_pages add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.page_elements add column if not exists client_key text;
create unique index if not exists books_org_client_key_unique on public.books(organization_id,client_key) where client_key is not null;
create unique index if not exists pages_book_client_key_unique on public.book_pages(book_id,client_key) where client_key is not null;
create unique index if not exists elements_page_client_key_unique on public.page_elements(page_id,client_key) where client_key is not null;

alter table public.assets add column if not exists checksum text;
alter table public.assets add column if not exists quarantine_status text not null default 'clean' check (quarantine_status in ('pending','clean','blocked'));
alter table public.assets add column if not exists deleted_at timestamptz;
alter table public.books add column if not exists deleted_at timestamptz;
alter table public.templates add column if not exists deleted_at timestamptz;

create table if not exists public.pending_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email=lower(email)),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  permission text not null default 'access',
  source_type text not null,
  source_id uuid,
  expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending','claimed','revoked','expired')),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(email,resource_type,resource_id,source_type,source_id)
);
create index if not exists pending_access_email_status_idx on public.pending_access_grants(email,status,created_at desc);
alter table public.pending_access_grants enable row level security;
create policy "pending grants admin read" on public.pending_access_grants for select using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "pending grants admin manage" on public.pending_access_grants for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

-- Replace the V1 profile trigger function so a public owner signup receives an isolated workspace automatically.
-- Existing invited accounts are not allowed to join an organization through untrusted signup metadata.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid;
  v_name text;
  v_slug text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '');
  insert into public.profiles(id,full_name,avatar_url)
  values(new.id,coalesce(v_name,''),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set full_name=excluded.full_name,avatar_url=excluded.avatar_url,updated_at=now();

  if coalesce(new.raw_user_meta_data->>'role','owner')='owner' and not exists(select 1 from public.organization_members where user_id=new.id) then
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(v_name,split_part(new.email,'@',1),'h2obook')), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(new.id::text,'-',''),1,8);
    insert into public.organizations(name,slug,owner_id)
    values(coalesce(v_name,'H2OBOOK Workspace'),v_slug,new.id) returning id into v_org_id;
    insert into public.organization_members(organization_id,user_id,role,status) values(v_org_id,new.id,'owner','active');
  end if;
  return new;
end;
$$;

create or replace function public.can_access_publication(p_publication_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.publications p
    where p.id=p_publication_id and p.status='published' and (
      p.access_type='public' or
      public.is_org_member(p.organization_id) or
      exists(select 1 from public.entitlements e where e.user_id=auth.uid() and e.status='active' and (e.expires_at is null or e.expires_at>now()) and ((e.resource_type='publication' and e.resource_id=p.id) or (e.resource_type='book' and e.resource_id=p.book_id)))
    )
  );
$$;



create or replace function public.mark_order_paid(p_order_id uuid, p_transaction_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_expiry timestamptz;
  v_resource_id uuid;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_status='paid' then return; end if;
  update public.orders set payment_status='paid',order_status='fulfilled',provider_transaction_id=coalesce(p_transaction_id,provider_transaction_id),paid_at=now(),updated_at=now() where id=p_order_id;
  for v_item in select oi.*,p.product_type,p.reference_id,p.billing_interval,p.name as plan_name from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=p_order_id loop
    v_expiry := case when v_item.billing_interval='month' then now()+interval '1 month' when v_item.billing_interval='year' then now()+interval '1 year' else null end;
    v_resource_id := coalesce(v_item.reference_id,v_item.product_id);
    if v_order.buyer_id is null then
      insert into public.pending_access_grants(email,organization_id,resource_type,resource_id,permission,source_type,source_id,expires_at,status)
      values(lower(v_order.customer_email),v_order.organization_id,v_item.product_type,v_resource_id,'access','order',p_order_id,v_expiry,'pending')
      on conflict(email,resource_type,resource_id,source_type,source_id) do nothing;
    else
      insert into public.entitlements(user_id,organization_id,resource_type,resource_id,permission,source_type,source_id,starts_at,expires_at,status)
      values(v_order.buyer_id,v_order.organization_id,v_item.product_type,v_resource_id,'access','order',p_order_id,now(),v_expiry,'active')
      on conflict do nothing;
      if v_item.product_type='membership' then
        insert into public.memberships(organization_id,user_id,product_id,plan_name,price,currency,billing_interval,status,starts_at,renews_at,expires_at)
        values(v_order.organization_id,v_order.buyer_id,v_item.product_id,v_item.plan_name,v_item.unit_price,v_order.currency,coalesce(v_item.billing_interval,'month'),'active',now(),v_expiry,v_expiry)
        on conflict do nothing;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.claim_my_pending_access()
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_email text;
  v_grant record;
  v_count integer := 0;
  v_product record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select lower(email) into v_email from auth.users where id=auth.uid();
  if v_email is null then return 0; end if;
  for v_grant in select * from public.pending_access_grants where lower(email)=v_email and status='pending' for update loop
    insert into public.entitlements(user_id,organization_id,resource_type,resource_id,permission,source_type,source_id,starts_at,expires_at,status)
    values(auth.uid(),v_grant.organization_id,v_grant.resource_type,v_grant.resource_id,v_grant.permission,v_grant.source_type,v_grant.source_id,now(),v_grant.expires_at,'active')
    on conflict do nothing;
    if v_grant.resource_type='membership' and v_grant.source_id is not null then
      select p.id,p.name,p.price,p.currency,p.billing_interval into v_product
      from public.order_items oi join public.products p on p.id=oi.product_id
      where oi.order_id=v_grant.source_id and coalesce(p.reference_id,p.id)=v_grant.resource_id limit 1;
      if found then
        insert into public.memberships(organization_id,user_id,product_id,plan_name,price,currency,billing_interval,status,starts_at,renews_at,expires_at)
        values(v_grant.organization_id,auth.uid(),v_product.id,v_product.name,v_product.price,v_product.currency,coalesce(v_product.billing_interval,'month'),'active',now(),v_grant.expires_at,v_grant.expires_at)
        on conflict do nothing;
      end if;
    end if;
    update public.pending_access_grants set status='claimed',claimed_by=auth.uid(),claimed_at=now() where id=v_grant.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.save_book_document(p_organization_id uuid, p_client_key text, p_slug text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_book_id uuid;
  v_page_id uuid;
  v_page jsonb;
  v_element jsonb;
  v_page_position integer := 0;
  v_element_position integer;
  v_version integer;
begin
  if not public.has_org_role(p_organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]) then
    raise exception 'Forbidden';
  end if;
  if p_client_key is null or p_client_key='' or coalesce(p_payload->>'title','')='' then raise exception 'Invalid book payload'; end if;

  select id,current_version into v_book_id,v_version from public.books where organization_id=p_organization_id and client_key=p_client_key for update;
  if v_book_id is null then
    insert into public.books(organization_id,owner_id,client_key,title,slug,subtitle,description,author,status,cover,page_width,page_height,current_version,updated_at)
    values(
      p_organization_id,auth.uid(),p_client_key,p_payload->>'title',p_slug,
      coalesce(p_payload->>'subtitle',''),coalesce(p_payload->>'description',''),coalesce(p_payload->>'author',''),
      (case when p_payload->>'status'='published' then 'published' when p_payload->>'status'='archived' then 'archived' else 'draft' end)::public.book_status,
      jsonb_build_object('value',coalesce(p_payload->>'cover','')),
      coalesce(((p_payload->'pages'->0)->>'width')::integer,794),
      coalesce(((p_payload->'pages'->0)->>'height')::integer,1123),1,now()
    ) returning id,current_version into v_book_id,v_version;
  else
    v_version := coalesce(v_version,0) + 1;
    update public.books set
      title=p_payload->>'title',subtitle=coalesce(p_payload->>'subtitle',''),description=coalesce(p_payload->>'description',''),
      author=coalesce(p_payload->>'author',''),status=(case when p_payload->>'status'='published' then 'published' when p_payload->>'status'='archived' then 'archived' else 'draft' end)::public.book_status,
      cover=jsonb_build_object('value',coalesce(p_payload->>'cover','')),
      page_width=coalesce(((p_payload->'pages'->0)->>'width')::integer,page_width),
      page_height=coalesce(((p_payload->'pages'->0)->>'height')::integer,page_height),current_version=v_version,updated_at=now()
    where id=v_book_id;
  end if;

  delete from public.book_pages where book_id=v_book_id;
  for v_page in select value from jsonb_array_elements(coalesce(p_payload->'pages','[]'::jsonb)) loop
    insert into public.book_pages(book_id,client_key,name,position,width,height,background,metadata,revision,updated_at)
    values(
      v_book_id,v_page->>'id',coalesce(v_page->>'name','Trang'),v_page_position,
      coalesce((v_page->>'width')::integer,794),coalesce((v_page->>'height')::integer,1123),
      jsonb_build_object('type','color','value',coalesce(v_page->>'background','#ffffff')),
      jsonb_strip_nulls(jsonb_build_object('pageType',v_page->>'pageType','chapter',v_page->>'chapter','notes',v_page->>'notes','hidden',(v_page->>'hidden')::boolean,'masterPageId',v_page->>'masterPageId')),
      1,now()
    ) returning id into v_page_id;
    v_element_position := 0;
    for v_element in select value from jsonb_array_elements(coalesce(v_page->'elements','[]'::jsonb)) loop
      insert into public.page_elements(page_id,client_key,element_type,name,position_index,transform,content,style,binding,permissions,locked,hidden,revision,updated_at)
      values(
        v_page_id,v_element->>'id',v_element->>'type',coalesce(v_element->>'name','Element'),v_element_position,
        jsonb_build_object('x',coalesce((v_element->>'x')::numeric,0),'y',coalesce((v_element->>'y')::numeric,0),'width',coalesce((v_element->>'width')::numeric,100),'height',coalesce((v_element->>'height')::numeric,100),'rotation',coalesce((v_element->>'rotation')::numeric,0),'opacity',coalesce((v_element->>'opacity')::numeric,1)),
        jsonb_strip_nulls(jsonb_build_object('text',v_element->>'text','sourceText',v_element->>'sourceText','imageUrl',v_element->>'imageUrl','qrValue',v_element->>'qrValue','sourceQrValue',v_element->>'sourceQrValue')),
        jsonb_strip_nulls(jsonb_build_object('fill',v_element->>'fill','stroke',v_element->>'stroke','strokeWidth',(v_element->>'strokeWidth')::numeric,'dash',v_element->'dash','fontSize',(v_element->>'fontSize')::numeric,'fontFamily',v_element->>'fontFamily','fontWeight',(v_element->>'fontWeight')::numeric,'fontStyle',v_element->>'fontStyle','textDecoration',v_element->>'textDecoration','lineHeight',(v_element->>'lineHeight')::numeric,'letterSpacing',(v_element->>'letterSpacing')::numeric,'align',v_element->>'align','verticalAlign',v_element->>'verticalAlign','imageFit',v_element->>'imageFit','cornerRadius',(v_element->>'cornerRadius')::numeric,'shadow',v_element->'shadow')),
        jsonb_strip_nulls(jsonb_build_object('key',v_element->>'bindingKey','fallback',v_element->>'bindingFallback','sourceElementId',v_element->>'sourceElementId','sourceRevision',(v_element->>'sourceRevision')::integer,'localRevision',(v_element->>'localRevision')::integer)),
        coalesce(v_element->'permissions','{"canEditContent":true,"canMove":true,"canResize":true,"canDelete":true,"canChangeColor":true}'::jsonb),
        coalesce((v_element->>'locked')::boolean,false),coalesce((v_element->>'hidden')::boolean,false),greatest(1,coalesce((v_element->>'localRevision')::integer,1)),now()
      );
      v_element_position := v_element_position + 1;
    end loop;
    v_page_position := v_page_position + 1;
  end loop;

  insert into public.book_versions(book_id,version_number,change_note,snapshot,created_by)
  values(v_book_id,coalesce(v_version,1),'Cloud save',jsonb_build_object('clientKey',p_client_key,'pageCount',v_page_position,'savedAt',now()),auth.uid());
  return v_book_id;
end;
$$;

create or replace function public.audit_critical_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(organization_id,actor_id,action,resource_type,resource_id,metadata)
  values(coalesce(new.organization_id,old.organization_id),auth.uid(),tg_op||'_'||tg_table_name,tg_table_name,coalesce(new.id,old.id),jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new)));
  return coalesce(new,old);
end;
$$;

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='audit_orders_critical') then
    create trigger audit_orders_critical after update on public.orders for each row when (old.payment_status is distinct from new.payment_status) execute function public.audit_critical_change();
  end if;
  if not exists(select 1 from pg_trigger where tgname='audit_memberships_critical') then
    create trigger audit_memberships_critical after update on public.memberships for each row when (old.status is distinct from new.status) execute function public.audit_critical_change();
  end if;
end $$;

commit;


-- ===== 0006_h2obook_v4_smart_core.sql =====
begin;

create table if not exists public.smart_core_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  ai_enabled boolean not null default false,
  assist_mode text not null default 'local' check (assist_mode in ('local','external','off')),
  offline_first boolean not null default true,
  auto_generate_study_cards boolean not null default true,
  reduce_motion boolean not null default false,
  high_contrast boolean not null default false,
  focus_mode boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  title text not null,
  description text not null default '',
  progress smallint not null default 0 check (progress between 0 and 100),
  status text not null default 'active' check (status in ('active','completed','paused')),
  target_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page_id uuid references public.book_pages(id) on delete set null,
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  page_id uuid references public.book_pages(id) on delete set null,
  front text not null,
  back text not null,
  tags text[] not null default '{}',
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  next_review_at timestamptz not null default now(),
  interval_days integer not null default 1 check (interval_days between 1 and 3650),
  review_count integer not null default 0,
  correct_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  goal_id uuid references public.learning_goals(id) on delete set null,
  mode text not null check (mode in ('read','review','practice','reflect')),
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 1440),
  completed_items integer not null default 0,
  note text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  source_type text not null check (source_type in ('book','pdf','docx','image','audio','video','url','note')),
  status text not null default 'ready' check (status in ('ready','processing','error')),
  book_id uuid references public.books(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  source_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reusable_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  category text not null check (category in ('lesson','practice','marketing','profile','assessment')),
  description text not null default '',
  block_schema jsonb not null default '{}'::jsonb,
  preview_asset_id uuid references public.assets(id) on delete set null,
  is_system boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_goals_user_status_idx on public.learning_goals(user_id,status);
create index if not exists learning_notes_book_user_idx on public.learning_notes(book_id,user_id);
create index if not exists flashcards_due_idx on public.flashcards(user_id,next_review_at);
create index if not exists study_sessions_user_started_idx on public.study_sessions(user_id,started_at desc);
create index if not exists knowledge_sources_org_type_idx on public.knowledge_sources(organization_id,source_type);
create index if not exists reusable_blocks_org_category_idx on public.reusable_blocks(organization_id,category);

alter table public.smart_core_settings enable row level security;
alter table public.learning_goals enable row level security;
alter table public.learning_notes enable row level security;
alter table public.flashcards enable row level security;
alter table public.study_sessions enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.reusable_blocks enable row level security;

create policy "smart settings org read" on public.smart_core_settings for select using (public.is_org_member(organization_id));
create policy "smart settings admin write" on public.smart_core_settings for all using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "learning goals own" on public.learning_goals for all using (user_id=auth.uid() and public.is_org_member(organization_id)) with check (user_id=auth.uid() and public.is_org_member(organization_id));
create policy "learning notes own" on public.learning_notes for all using (user_id=auth.uid() and public.is_org_member(organization_id)) with check (user_id=auth.uid() and public.is_org_member(organization_id));
create policy "flashcards own" on public.flashcards for all using (user_id=auth.uid() and public.is_org_member(organization_id)) with check (user_id=auth.uid() and public.is_org_member(organization_id));
create policy "study sessions own" on public.study_sessions for all using (user_id=auth.uid() and public.is_org_member(organization_id)) with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "knowledge sources org read" on public.knowledge_sources for select using (public.is_org_member(organization_id));
create policy "knowledge sources editor write" on public.knowledge_sources for all using (public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[]));

create policy "blocks visible" on public.reusable_blocks for select using (is_system or public.is_org_member(organization_id));
create policy "blocks editor write" on public.reusable_blocks for all using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check (organization_id is not null and public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[]));

create or replace function public.review_flashcard(p_card_id uuid, p_remembered boolean)
returns public.flashcards
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_card public.flashcards;
  v_interval integer;
begin
  select * into v_card from public.flashcards where id=p_card_id and user_id=auth.uid() for update;
  if v_card.id is null then raise exception 'FLASHCARD_NOT_FOUND'; end if;
  v_interval := case when p_remembered then least(60,greatest(1,round(v_card.interval_days*2.2)::integer)) else 1 end;
  update public.flashcards set
    review_count=review_count+1,
    correct_count=correct_count+case when p_remembered then 1 else 0 end,
    difficulty=case when p_remembered then greatest(1,difficulty-1) else least(5,difficulty+1) end,
    interval_days=v_interval,
    next_review_at=now()+(v_interval||' days')::interval,
    updated_at=now()
  where id=p_card_id returning * into v_card;
  return v_card;
end;
$$;

comment on table public.smart_core_settings is 'H2OBOOK V4 settings. AI remains optional and disabled by default.';
comment on table public.flashcards is 'Offline-first spaced repetition cards; no model API is required.';
comment on table public.reusable_blocks is 'Reusable content blocks inspired by professional authoring systems.';

commit;


-- ===== 0007_h2obook_v41_production_foundation.sql =====
-- H2OBOOK 4.1 Production Foundation
-- Domain events, optimistic revisions, consistent updated_at and realtime publication.

create table if not exists public.domain_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  resource_type text not null,
  resource_id uuid,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists domain_events_org_time_idx on public.domain_events(organization_id, occurred_at desc);
create index if not exists domain_events_resource_idx on public.domain_events(resource_type, resource_id, occurred_at desc);

alter table public.domain_events enable row level security;

drop policy if exists domain_events_select on public.domain_events;
create policy domain_events_select on public.domain_events for select using (public.is_org_member(organization_id));
drop policy if exists domain_events_insert on public.domain_events;
create policy domain_events_insert on public.domain_events for insert with check (public.is_org_member(organization_id));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'brand_profiles','templates','classes','assignments','quizzes','review_requests',
    'automation_rules','license_agreements','white_label_portals','learning_goals',
    'flashcards','knowledge_sources','reusable_blocks'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.capture_domain_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  org_id uuid;
  row_id uuid;
  event_kind text;
begin
  org_id := coalesce((to_jsonb(new)->>'organization_id')::uuid, (to_jsonb(old)->>'organization_id')::uuid);
  row_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);
  event_kind := lower(tg_op);
  if org_id is not null then
    insert into public.domain_events(organization_id, actor_id, resource_type, resource_id, event_name, payload)
    values(org_id, auth.uid(), tg_table_name, row_id, event_kind, jsonb_build_object('new', to_jsonb(new), 'old', to_jsonb(old)));
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'brand_profiles','templates','book_clones','classes','assignments','quizzes','review_requests',
    'automation_rules','license_agreements','royalty_payouts','white_label_portals','notifications',
    'learning_goals','flashcards','knowledge_sources','reusable_blocks'
  ] loop
    execute format('drop trigger if exists %I_domain_event on public.%I', table_name, table_name);
    execute format('create trigger %I_domain_event after insert or update or delete on public.%I for each row execute function public.capture_domain_event()', table_name, table_name);
  end loop;
end $$;

-- Realtime is optional; duplicate_object is ignored when a table is already published.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'brand_profiles','templates','book_clones','classes','assignments','quizzes','review_requests',
    'automation_rules','license_agreements','royalty_payouts','white_label_portals','notifications',
    'learning_goals','flashcards','knowledge_sources','reusable_blocks','domain_events'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;


-- ===== 0008_h2obook_v42_semantic_content.sql =====
-- H2OBOOK 4.2 Semantic Content & Asset Architecture

create table if not exists public.book_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null unique references public.books(id) on delete cascade,
  title text not null,
  language text not null default 'vi',
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.book_documents(id) on delete cascade,
  parent_id uuid references public.content_nodes(id) on delete cascade,
  node_type text not null check (node_type in ('chapter','section','heading','paragraph','list','list_item','image','table','quote','quiz','footnote','citation','divider','callout','interactive')),
  position integer not null default 0,
  text_content jsonb not null default '[]'::jsonb,
  attrs jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_node_versions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  node_id uuid not null references public.content_nodes(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(node_id,version)
);

create table if not exists public.content_styles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  name text not null,
  style_type text not null check (style_type in ('paragraph','character','table','object')),
  properties jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,book_id,name,style_type)
);

create table if not exists public.layout_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  name text not null,
  profile_type text not null check (profile_type in ('web','mobile','print_a4','print_a5','square','workbook','presenter','epub_reflow','epub_fixed')),
  page_width numeric(12,3) not null,
  page_height numeric(12,3) not null,
  unit text not null default 'px' check (unit in ('px','pt','mm')),
  margins jsonb not null default '{"top":0,"right":0,"bottom":0,"left":0}'::jsonb,
  bleed jsonb not null default '{"top":0,"right":0,"bottom":0,"left":0}'::jsonb,
  columns integer not null default 1 check (columns between 1 and 12),
  column_gap numeric(12,3) not null default 0,
  settings jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  layout_profile_id uuid not null references public.layout_profiles(id) on delete cascade,
  name text not null,
  page_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flow_chains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  layout_profile_id uuid not null references public.layout_profiles(id) on delete cascade,
  name text not null,
  content_node_id uuid references public.content_nodes(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.layout_frames (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  layout_profile_id uuid not null references public.layout_profiles(id) on delete cascade,
  page_id uuid references public.book_pages(id) on delete cascade,
  master_page_id uuid references public.master_pages(id) on delete set null,
  frame_type text not null check (frame_type in ('text','image','decoration','header','footer')),
  x numeric(12,3) not null,
  y numeric(12,3) not null,
  width numeric(12,3) not null,
  height numeric(12,3) not null,
  flow_chain_id uuid references public.flow_chains(id) on delete set null,
  content_node_id uuid references public.content_nodes(id) on delete set null,
  style_id uuid references public.content_styles(id) on delete set null,
  locked boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.citations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.book_documents(id) on delete cascade,
  node_id uuid references public.content_nodes(id) on delete cascade,
  citation_key text not null,
  citation_style text not null default 'apa',
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id,citation_key)
);

create table if not exists public.footnotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.book_documents(id) on delete cascade,
  node_id uuid references public.content_nodes(id) on delete cascade,
  marker text not null,
  content jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  variant_type text not null check (variant_type in ('thumbnail','editor','reader','print','webp','avif')),
  storage_key text not null,
  mime_type text not null,
  width integer,
  height integer,
  size_bytes bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(asset_id,variant_type)
);

create index if not exists content_nodes_document_tree_idx on public.content_nodes(document_id,parent_id,position);
create index if not exists layout_profiles_book_idx on public.layout_profiles(book_id,profile_type);
create index if not exists layout_frames_profile_page_idx on public.layout_frames(layout_profile_id,page_id);
create index if not exists asset_variants_asset_idx on public.asset_variants(asset_id,variant_type);

alter table public.book_documents enable row level security;
alter table public.content_nodes enable row level security;
alter table public.content_node_versions enable row level security;
alter table public.content_styles enable row level security;
alter table public.layout_profiles enable row level security;
alter table public.master_pages enable row level security;
alter table public.flow_chains enable row level security;
alter table public.layout_frames enable row level security;
alter table public.citations enable row level security;
alter table public.footnotes enable row level security;
alter table public.asset_variants enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['book_documents','content_nodes','content_node_versions','content_styles','layout_profiles','master_pages','flow_chains','layout_frames','citations','footnotes','asset_variants'] loop
    execute format('drop policy if exists %I_member_select on public.%I',table_name,table_name);
    execute format('create policy %I_member_select on public.%I for select using (public.is_org_member(organization_id))',table_name,table_name);
    execute format('drop policy if exists %I_editor_write on public.%I',table_name,table_name);
    execute format('create policy %I_editor_write on public.%I for all using (public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[])) with check (public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[]))',table_name,table_name);
  end loop;
end $$;

create or replace function public.capture_content_node_version()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and (old.text_content is distinct from new.text_content or old.attrs is distinct from new.attrs or old.parent_id is distinct from new.parent_id or old.position is distinct from new.position) then
    insert into public.content_node_versions(organization_id,node_id,version,snapshot,created_by)
    values(old.organization_id,old.id,old.version,to_jsonb(old),auth.uid())
    on conflict(node_id,version) do nothing;
    new.version=old.version+1;
  end if;
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists content_nodes_version_trigger on public.content_nodes;
create trigger content_nodes_version_trigger before update on public.content_nodes for each row execute function public.capture_content_node_version();

create or replace function public.save_book_semantic_document(
  p_organization_id uuid,
  p_book_id uuid,
  p_title text,
  p_language text,
  p_metadata jsonb,
  p_version integer,
  p_nodes jsonb
) returns uuid language plpgsql security invoker set search_path=public as $$
declare
  v_document_id uuid;
  item jsonb;
begin
  if not public.has_org_role(p_organization_id,array['owner','admin','designer']::public.member_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists(select 1 from public.books where id=p_book_id and organization_id=p_organization_id) then
    raise exception 'BOOK_NOT_FOUND';
  end if;
  insert into public.book_documents(organization_id,book_id,title,language,metadata,version,created_by)
  values(p_organization_id,p_book_id,p_title,coalesce(p_language,'vi'),coalesce(p_metadata,'{}'::jsonb),greatest(coalesce(p_version,1),1),auth.uid())
  on conflict(book_id) do update set title=excluded.title,language=excluded.language,metadata=excluded.metadata,version=excluded.version,updated_at=now()
  returning id into v_document_id;

  delete from public.content_nodes where document_id=v_document_id;
  for item in select value from jsonb_array_elements(coalesce(p_nodes,'[]'::jsonb)) loop
    insert into public.content_nodes(id,organization_id,document_id,parent_id,node_type,position,text_content,attrs,version)
    values(
      (item->>'id')::uuid,p_organization_id,v_document_id,nullif(item->>'parentId','')::uuid,
      item->>'type',coalesce((item->>'position')::integer,0),coalesce(item->'text','[]'::jsonb),
      coalesce(item->'attrs','{}'::jsonb),greatest(coalesce((item->>'version')::integer,1),1)
    );
  end loop;
  return v_document_id;
end;
$$;

grant execute on function public.save_book_semantic_document(uuid,uuid,text,text,jsonb,integer,jsonb) to authenticated;


-- ===== 0009_h2obook_v43_authoring_editor.sql =====
-- H2OBOOK 4.3 Professional Authoring Editor

create table if not exists public.editor_operations (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  transaction_id uuid not null default gen_random_uuid(),
  operation_type text not null,
  forward_patch jsonb not null,
  inverse_patch jsonb not null,
  sequence_number bigint not null,
  created_at timestamptz not null default now(),
  unique(book_id,sequence_number)
);

create table if not exists public.editor_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  document_id uuid references public.book_documents(id) on delete cascade,
  content_node_id uuid references public.content_nodes(id) on delete cascade,
  page_id uuid references public.book_pages(id) on delete cascade,
  element_id uuid,
  anchor jsonb not null default '{}'::jsonb,
  body text not null,
  status text not null default 'open' check(status in ('open','resolved','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.track_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.book_documents(id) on delete cascade,
  node_id uuid references public.content_nodes(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  change_type text not null check(change_type in ('insert','delete','format','move')),
  before_value jsonb,
  after_value jsonb,
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  element_id text,
  destination_url text not null,
  tracking_code text not null unique,
  error_correction text not null default 'H' check(error_correction in ('L','M','Q','H')),
  scan_count bigint not null default 0,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preflight_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  book_version_id uuid references public.book_versions(id) on delete set null,
  profile_type text not null default 'web',
  passed boolean not null default false,
  error_count integer not null default 0,
  warning_count integer not null default 0,
  issues jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists editor_operations_book_sequence_idx on public.editor_operations(book_id,sequence_number desc);
create index if not exists editor_comments_book_status_idx on public.editor_comments(book_id,status,created_at desc);
create index if not exists track_changes_document_status_idx on public.track_changes(document_id,status,created_at);
create index if not exists preflight_reports_book_created_idx on public.preflight_reports(book_id,created_at desc);

alter table public.editor_operations enable row level security;
alter table public.editor_comments enable row level security;
alter table public.track_changes enable row level security;
alter table public.qr_codes enable row level security;
alter table public.preflight_reports enable row level security;

do $$ declare table_name text;
begin
  foreach table_name in array array['editor_operations','editor_comments','track_changes','qr_codes','preflight_reports'] loop
    execute format('create policy %I_member_select on public.%I for select using (public.is_org_member(organization_id))',table_name,table_name);
    execute format('create policy %I_editor_write on public.%I for all using (public.has_org_role(organization_id,array[''owner'',''admin'',''designer'',''teacher'']::public.member_role[])) with check (public.has_org_role(organization_id,array[''owner'',''admin'',''designer'',''teacher'']::public.member_role[]))',table_name,table_name);
  end loop;
end $$;


-- ===== 0010_h2obook_v44_publishing_engine.sql =====
-- H2OBOOK 4.4 Professional Publishing Engine
create table if not exists public.publishing_profiles(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,book_id uuid references public.books(id) on delete cascade,name text not null,profile_type text not null,settings jsonb not null default '{}'::jsonb,is_default boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.publishing_jobs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,book_id uuid not null references public.books(id) on delete cascade,book_version_id uuid references public.book_versions(id) on delete set null,profile_id text not null,format text not null check(format in ('pdf_web','pdf_print','epub_reflow','epub_fixed','scorm12','scorm2004','xapi')),status text not null default 'queued' check(status in ('queued','processing','completed','failed','cancelled')),progress integer not null default 0,queue_job_id text,input jsonb not null default '{}'::jsonb,output jsonb not null default '{}'::jsonb,error_message text,created_by uuid references public.profiles(id) on delete set null,started_at timestamptz,completed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.publishing_artifacts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,publishing_job_id uuid not null references public.publishing_jobs(id) on delete cascade,book_id uuid not null references public.books(id) on delete cascade,format text not null,storage_key text not null,mime_type text not null,size_bytes bigint not null default 0,checksum text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create table if not exists public.lms_packages(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,book_id uuid not null references public.books(id) on delete cascade,artifact_id uuid references public.publishing_artifacts(id) on delete set null,standard text not null check(standard in ('scorm12','scorm2004','xapi','lti13')),completion_rule jsonb not null default '{}'::jsonb,grade_rule jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index if not exists publishing_jobs_org_status_idx on public.publishing_jobs(organization_id,status,created_at desc);create index if not exists publishing_artifacts_book_idx on public.publishing_artifacts(book_id,created_at desc);
alter table public.publishing_profiles enable row level security;alter table public.publishing_jobs enable row level security;alter table public.publishing_artifacts enable row level security;alter table public.lms_packages enable row level security;
do $$ declare t text;begin foreach t in array array['publishing_profiles','publishing_jobs','publishing_artifacts','lms_packages'] loop execute format('create policy %I_read on public.%I for select using(public.is_org_member(organization_id))',t,t);execute format('create policy %I_write on public.%I for all using(public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[])) with check(public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[]))',t,t);end loop;end $$;


-- ===== 0011_h2obook_v45_universal_ingestion.sql =====
-- H2OBOOK 4.5 Universal Content Ingestion
create table if not exists public.ingestion_sources(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,source_type text not null,source_url text,title text not null,asset_id uuid references public.assets(id) on delete set null,content_hash text,metadata jsonb not null default '{}'::jsonb,status text not null default 'ready' check(status in ('pending','ready','blocked','failed')),created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.ingestion_runs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,source_id uuid references public.ingestion_sources(id) on delete set null,source_type text not null,source_url text,title text not null,status text not null default 'queued' check(status in ('queued','extracting','normalizing','previewed','approved','completed','failed','cancelled')),progress integer not null default 0,preview jsonb not null default '{}'::jsonb,settings jsonb not null default '{}'::jsonb,error_message text,book_id uuid references public.books(id) on delete set null,created_by uuid references public.profiles(id) on delete set null,started_at timestamptz,completed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.ingestion_segments(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,run_id uuid not null references public.ingestion_runs(id) on delete cascade,segment_type text not null,position integer not null,source_text text,normalized_node jsonb not null default '{}'::jsonb,confidence numeric(5,4),manual_status text not null default 'unreviewed' check(manual_status in ('unreviewed','accepted','edited','rejected')),created_at timestamptz not null default now()
);
create table if not exists public.ingestion_mappings(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,run_id uuid not null references public.ingestion_runs(id) on delete cascade,source_path text not null,target_node_type text not null,rules jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index if not exists ingestion_runs_org_status_idx on public.ingestion_runs(organization_id,status,created_at desc);create index if not exists ingestion_segments_run_position_idx on public.ingestion_segments(run_id,position);
alter table public.ingestion_sources enable row level security;alter table public.ingestion_runs enable row level security;alter table public.ingestion_segments enable row level security;alter table public.ingestion_mappings enable row level security;
do $$ declare t text;begin foreach t in array array['ingestion_sources','ingestion_runs','ingestion_segments','ingestion_mappings'] loop execute format('drop policy if exists %I_read on public.%I',t,t);execute format('create policy %I_read on public.%I for select using(public.is_org_member(organization_id))',t,t);execute format('drop policy if exists %I_write on public.%I',t,t);execute format('create policy %I_write on public.%I for all using(public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[])) with check(public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[]))',t,t);end loop;end $$;


-- ===== 0012_h2obook_v46_data_automation.sql =====
-- H2OBOOK 4.6 Data Automation and Bulk Publishing
create table if not exists public.data_sources(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,source_type text not null check(source_type in ('csv','excel','google_sheets','api','form')),source_url text,asset_id uuid references public.assets(id) on delete set null,headers jsonb not null default '[]'::jsonb,row_count integer not null default 0,content_hash text,settings jsonb not null default '{}'::jsonb,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.bulk_generation_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,template_book_id uuid not null references public.books(id) on delete cascade,data_source_id uuid references public.data_sources(id) on delete set null,name text not null,status text not null default 'draft' check(status in ('draft','previewed','approved','queued','running','paused','completed','failed','cancelled')),row_count integer not null default 0,success_count integer not null default 0,error_count integer not null default 0,current_row integer not null default 0,mapping jsonb not null default '{}'::jsonb,settings jsonb not null default '{}'::jsonb,error_message text,created_by uuid references public.profiles(id) on delete set null,started_at timestamptz,completed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.bulk_generation_items(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,job_id uuid not null references public.bulk_generation_jobs(id) on delete cascade,row_number integer not null,row_data jsonb not null,generated_book_id uuid references public.books(id) on delete set null,artifact_ids uuid[] not null default '{}',status text not null default 'pending' check(status in ('pending','valid','invalid','generating','completed','failed','skipped')),warnings jsonb not null default '[]'::jsonb,error_message text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(job_id,row_number));
create table if not exists public.template_data_mappings(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,template_book_id uuid not null references public.books(id) on delete cascade,name text not null,mapping jsonb not null default '{}'::jsonb,conditional_rules jsonb not null default '[]'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists bulk_jobs_org_status_idx on public.bulk_generation_jobs(organization_id,status,created_at desc);create index if not exists bulk_items_job_row_idx on public.bulk_generation_items(job_id,row_number);
alter table public.data_sources enable row level security;alter table public.bulk_generation_jobs enable row level security;alter table public.bulk_generation_items enable row level security;alter table public.template_data_mappings enable row level security;
do $$ declare t text;begin foreach t in array array['data_sources','bulk_generation_jobs','bulk_generation_items','template_data_mappings'] loop execute format('create policy %I_read on public.%I for select using(public.is_org_member(organization_id))',t,t);execute format('create policy %I_write on public.%I for all using(public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[])) with check(public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[]))',t,t);end loop;end $$;


-- ===== 0013_h2obook_v47_growth_reader.sql =====
-- H2OBOOK 4.7 Growth Reader and Content Commerce
create table if not exists public.reader_campaigns(id uuid primary key default gen_random_uuid(),client_key text unique,organization_id uuid not null references public.organizations(id) on delete cascade,book_id uuid not null references public.books(id) on delete cascade,name text not null,status text not null default 'draft' check(status in ('draft','active','paused','archived')),preview_pages integer not null default 5,lead_gate_page integer,lead_fields jsonb not null default '["name","email"]'::jsonb,download_requires_lead boolean not null default false,cta_page integer,cta_label text,cta_url text,utm_capture boolean not null default true,crm_webhook_enabled boolean not null default false,settings jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.reader_leads(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,book_id uuid not null references public.books(id) on delete cascade,campaign_id uuid references public.reader_campaigns(id) on delete set null,email text not null,name text,phone text,company text,utm jsonb not null default '{}'::jsonb,session_id text,consent jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),unique(campaign_id,email));
create table if not exists public.protected_embeds(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,book_id uuid not null references public.books(id) on delete cascade,enabled boolean not null default true,allowed_domains text[] not null default '{}',token_ttl_seconds integer not null default 600,settings jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(book_id));
create table if not exists public.reader_ctas(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,campaign_id uuid not null references public.reader_campaigns(id) on delete cascade,page_number integer not null,label text not null,target_url text not null,cta_type text not null default 'button',settings jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table if not exists public.reader_sessions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,book_id uuid not null references public.books(id) on delete cascade,campaign_id uuid references public.reader_campaigns(id) on delete set null,user_id uuid references public.profiles(id) on delete set null,anonymous_id text,utm jsonb not null default '{}'::jsonb,referrer text,started_at timestamptz not null default now(),ended_at timestamptz,last_page integer not null default 1,max_page integer not null default 1,lead_id uuid references public.reader_leads(id) on delete set null,created_at timestamptz not null default now());
create index if not exists reader_campaigns_book_status_idx on public.reader_campaigns(book_id,status);create index if not exists reader_leads_org_created_idx on public.reader_leads(organization_id,created_at desc);create index if not exists reader_sessions_book_started_idx on public.reader_sessions(book_id,started_at desc);
alter table public.reader_campaigns enable row level security;alter table public.reader_leads enable row level security;alter table public.protected_embeds enable row level security;alter table public.reader_ctas enable row level security;alter table public.reader_sessions enable row level security;
do $$ declare t text;begin foreach t in array array['reader_campaigns','reader_leads','protected_embeds','reader_ctas','reader_sessions'] loop execute format('create policy %I_read on public.%I for select using(public.is_org_member(organization_id))',t,t);execute format('create policy %I_write on public.%I for all using(public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[])) with check(public.has_org_role(organization_id,array[''owner'',''admin'',''designer'']::public.member_role[]))',t,t);end loop;end $$;


-- ===== 0014_h2obook_v48_education_collaboration.sql =====
-- H2OBOOK 4.8 Education Collaboration and Accessibility
create table if not exists public.student_remixes(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,master_book_id uuid not null references public.books(id) on delete cascade,master_version_id uuid references public.book_versions(id) on delete set null,student_id uuid not null references public.profiles(id) on delete cascade,class_id uuid references public.classes(id) on delete set null,status text not null default 'draft' check(status in ('draft','submitted','reviewed','returned')),progress integer not null default 0,submitted_at timestamptz,reviewed_at timestamptz,reviewed_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(master_book_id,student_id,class_id));
create table if not exists public.remix_responses(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,remix_id uuid not null references public.student_remixes(id) on delete cascade,page_id text not null,block_id text,response_type text not null check(response_type in ('text','image','file','checklist')),text_response text,asset_id uuid references public.assets(id) on delete set null,status text not null default 'draft' check(status in ('draft','submitted','reviewed')),teacher_feedback text,score numeric(6,2),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.class_progress_cells(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,class_id uuid not null references public.classes(id) on delete cascade,student_id uuid not null references public.profiles(id) on delete cascade,assignment_id uuid references public.assignments(id) on delete cascade,book_id uuid references public.books(id) on delete cascade,page_id text,status text not null default 'not_started' check(status in ('not_started','in_progress','submitted','reviewed','late')),progress integer not null default 0,score numeric(6,2),last_activity_at timestamptz,updated_at timestamptz not null default now(),unique(class_id,student_id,assignment_id,page_id));
create table if not exists public.accessibility_profiles(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,font_scale numeric(4,2) not null default 1,high_contrast boolean not null default false,dyslexia_friendly boolean not null default false,reduced_motion boolean not null default false,text_to_speech_rate numeric(4,2) not null default 1,settings jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now(),unique(user_id));
create table if not exists public.accessibility_reports(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,book_id uuid not null references public.books(id) on delete cascade,book_version_id uuid references public.book_versions(id) on delete set null,score integer not null default 0,issues jsonb not null default '[]'::jsonb,reading_order jsonb not null default '[]'::jsonb,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now());
create index if not exists remixes_student_status_idx on public.student_remixes(student_id,status,updated_at desc);create index if not exists class_progress_matrix_idx on public.class_progress_cells(class_id,student_id,assignment_id);
alter table public.student_remixes enable row level security;alter table public.remix_responses enable row level security;alter table public.class_progress_cells enable row level security;alter table public.accessibility_profiles enable row level security;alter table public.accessibility_reports enable row level security;
create policy remixes_student_read on public.student_remixes for select using(student_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));create policy remixes_student_write on public.student_remixes for all using(student_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check(student_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy responses_read on public.remix_responses for select using(exists(select 1 from public.student_remixes r where r.id=remix_id and (r.student_id=auth.uid() or public.has_org_role(r.organization_id,array['owner','admin','teacher']::public.member_role[]))));create policy responses_write on public.remix_responses for all using(exists(select 1 from public.student_remixes r where r.id=remix_id and (r.student_id=auth.uid() or public.has_org_role(r.organization_id,array['owner','admin','teacher']::public.member_role[])))) with check(public.is_org_member(organization_id));
create policy class_progress_read on public.class_progress_cells for select using(student_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));create policy class_progress_write on public.class_progress_cells for all using(public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])) with check(public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy accessibility_profile_self on public.accessibility_profiles for all using(user_id=auth.uid()) with check(user_id=auth.uid());create policy accessibility_reports_read on public.accessibility_reports for select using(public.is_org_member(organization_id));create policy accessibility_reports_write on public.accessibility_reports for all using(public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check(public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[]));


-- ===== 0015_h2obook_v49_analytics_event_engine.sql =====
-- H2OBOOK 4.9 Analytics Event Engine
alter table public.analytics_events add column if not exists event_id uuid;alter table public.analytics_events add column if not exists resource_client_key text;alter table public.analytics_events add column if not exists received_at timestamptz not null default now();alter table public.analytics_events add column if not exists schema_version integer not null default 1;
create unique index if not exists analytics_event_id_unique on public.analytics_events(event_id) where event_id is not null;create index if not exists analytics_session_idx on public.analytics_events(session_id,occurred_at);create index if not exists analytics_resource_client_idx on public.analytics_events(resource_client_key,event_name,occurred_at desc);
create table if not exists public.analytics_consents(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,anonymous_id text,analytics_allowed boolean not null default true,marketing_allowed boolean not null default false,source text not null default 'reader',updated_at timestamptz not null default now(),check(user_id is not null or anonymous_id is not null));
create table if not exists public.analytics_daily_rollups(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,event_date date not null,book_id uuid references public.books(id) on delete cascade,metrics jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now(),unique(organization_id,event_date,book_id));
create table if not exists public.analytics_funnel_definitions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,steps jsonb not null default '[]'::jsonb,window_days integer not null default 30,active boolean not null default true,created_at timestamptz not null default now());
alter table public.analytics_consents enable row level security;alter table public.analytics_daily_rollups enable row level security;alter table public.analytics_funnel_definitions enable row level security;
create policy analytics_consent_self on public.analytics_consents for all using(user_id=auth.uid() or (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))) with check(user_id=auth.uid() or (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[])));
create policy analytics_rollups_read on public.analytics_daily_rollups for select using(public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));create policy analytics_rollups_write on public.analytics_daily_rollups for all using(public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check(public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy funnel_read on public.analytics_funnel_definitions for select using(public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));create policy funnel_write on public.analytics_funnel_definitions for all using(public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check(public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));


-- ===== 0016_h2obook_v410_optional_ai_assistance.sql =====
-- H2OBOOK 4.10 Optional AI Assistance: disabled by default
create table if not exists public.optional_ai_policies(id uuid primary key default gen_random_uuid(),organization_id uuid not null unique references public.organizations(id) on delete cascade,enabled boolean not null default false,default_mode text not null default 'local' check(default_mode in ('local','external')),monthly_budget_usd numeric(12,4) not null default 0,spent_usd numeric(12,6) not null default 0,billing_period date not null default date_trunc('month',now())::date,max_prompt_characters integer not null default 60000,cache_enabled boolean not null default true,allowed_tasks text[] not null default array['outline','rewrite','quiz','summary','brand_copy','translate','accessibility'],allow_image_input boolean not null default false,allow_external_sources boolean not null default false,settings jsonb not null default '{}'::jsonb,updated_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.optional_ai_usage(id bigint generated always as identity primary key,organization_id uuid not null references public.organizations(id) on delete cascade,user_id uuid references public.profiles(id) on delete set null,task_type text not null,provider text not null,model text,input_tokens integer not null default 0,output_tokens integer not null default 0,cost_usd numeric(12,6) not null default 0,cache_hit boolean not null default false,request_hash text,created_at timestamptz not null default now());
create table if not exists public.optional_ai_cache(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,cache_key text not null,task_type text not null,provider text not null,output text not null,usage jsonb not null default '{}'::jsonb,expires_at timestamptz not null,created_at timestamptz not null default now(),unique(organization_id,cache_key));
create index if not exists optional_ai_usage_org_month_idx on public.optional_ai_usage(organization_id,created_at desc);create index if not exists optional_ai_cache_expiry_idx on public.optional_ai_cache(expires_at);
alter table public.optional_ai_policies enable row level security;alter table public.optional_ai_usage enable row level security;alter table public.optional_ai_cache enable row level security;
create policy optional_ai_policy_read on public.optional_ai_policies for select using(public.is_org_member(organization_id));create policy optional_ai_policy_write on public.optional_ai_policies for all using(public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check(public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy optional_ai_usage_read on public.optional_ai_usage for select using(public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));create policy optional_ai_usage_insert on public.optional_ai_usage for insert with check(public.is_org_member(organization_id));
create policy optional_ai_cache_read on public.optional_ai_cache for select using(public.is_org_member(organization_id));create policy optional_ai_cache_write on public.optional_ai_cache for all using(public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[])) with check(public.has_org_role(organization_id,array['owner','admin','designer','teacher']::public.member_role[]));
create or replace function public.increment_optional_ai_spend(p_organization_id uuid,p_amount numeric) returns void language plpgsql security definer set search_path=public as $$begin if not public.is_org_member(p_organization_id) then raise exception 'workspace forbidden';end if;update public.optional_ai_policies set spent_usd=case when billing_period=date_trunc('month',now())::date then spent_usd+greatest(p_amount,0) else greatest(p_amount,0) end,billing_period=date_trunc('month',now())::date,updated_at=now() where organization_id=p_organization_id;end$$;revoke all on function public.increment_optional_ai_spend(uuid,numeric) from public;grant execute on function public.increment_optional_ai_spend(uuid,numeric) to authenticated;


-- ===== 0017_h2obook_v411_marketplace_enterprise.sql =====
-- H2OBOOK 4.11 Marketplace and Enterprise Scale
-- platform_admin is not yet a real role in public.member_role (see 0001_h2obook_core.sql) or in
-- any accounts table, so this returns false until a follow-up migration introduces a real
-- platform-admin account model. Until then, marketplace moderation and SLA-incident writes are
-- deny-by-default for every authenticated user, which matches NEXT_PUBLIC_PLATFORM_ADMIN_V1=false.
create or replace function public.is_platform_admin()
returns boolean language sql stable as $$
  select false;
$$;

create table if not exists public.marketplace_listings(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,owner_id uuid references public.profiles(id) on delete set null,slug text not null unique,title text not null,description text not null default '',cover_asset_id uuid references public.assets(id) on delete set null,listing_type text not null check(listing_type in ('book','template','bundle','membership','license')),resource_id uuid,resource_client_key text,price numeric(14,2) not null default 0,currency text not null default 'VND',status text not null default 'draft' check(status in ('draft','submitted','in_review','changes_requested','published','suspended','archived')),quality_score integer not null default 0,rating numeric(3,2) not null default 0,review_count integer not null default 0,preview_config jsonb not null default '{}'::jsonb,license_config jsonb not null default '{}'::jsonb,moderation_notes text,published_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.marketplace_listing_versions(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.marketplace_listings(id) on delete cascade,version_number integer not null,snapshot jsonb not null,change_note text,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),unique(listing_id,version_number));
create table if not exists public.marketplace_reviews(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.marketplace_listings(id) on delete cascade,reviewer_id uuid not null references public.profiles(id) on delete cascade,rating integer not null check(rating between 1 and 5),title text,body text,status text not null default 'published' check(status in ('pending','published','hidden','reported')),verified_purchase boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(listing_id,reviewer_id));
create table if not exists public.marketplace_moderation_cases(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.marketplace_listings(id) on delete cascade,status text not null default 'open' check(status in ('open','reviewing','approved','changes_requested','rejected','closed')),checks jsonb not null default '[]'::jsonb,assigned_to uuid references public.profiles(id) on delete set null,decision text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.enterprise_org_units(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,parent_id uuid references public.enterprise_org_units(id) on delete cascade,name text not null,unit_type text not null default 'team',settings jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.sso_configurations(id uuid primary key default gen_random_uuid(),organization_id uuid not null unique references public.organizations(id) on delete cascade,provider_type text not null check(provider_type in ('saml','oidc')),enabled boolean not null default false,issuer text,authorization_url text,token_url text,certificate text,client_id text,client_secret_encrypted text,domain_allowlist text[] not null default '{}',settings jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.public_api_keys(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,key_prefix text not null,key_hash text not null unique,scopes text[] not null default '{}',last_used_at timestamptz,expires_at timestamptz,revoked_at timestamptz,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now());
create table if not exists public.webhook_endpoints(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,name text not null,url text not null,events text[] not null default '{}',secret_hash text not null,enabled boolean not null default true,last_success_at timestamptz,last_failure_at timestamptz,failure_count integer not null default 0,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.webhook_deliveries(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,event_id uuid,event_type text not null,payload jsonb not null,status text not null default 'queued' check(status in ('queued','sending','delivered','retry','failed','cancelled')),attempt_count integer not null default 0,next_attempt_at timestamptz not null default now(),response_status integer,response_body text,created_at timestamptz not null default now(),delivered_at timestamptz);
create table if not exists public.usage_quotas(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,metric text not null,period text not null default 'month',limit_value bigint not null,used_value bigint not null default 0,warning_percent integer not null default 85,period_started_at timestamptz not null default date_trunc('month',now()),period_ends_at timestamptz not null default date_trunc('month',now())+interval '1 month',updated_at timestamptz not null default now(),unique(organization_id,metric,period_started_at));
create table if not exists public.data_retention_policies(id uuid primary key default gen_random_uuid(),organization_id uuid not null unique references public.organizations(id) on delete cascade,analytics_days integer not null default 365,audit_days integer not null default 730,deleted_content_days integer not null default 30,legal_hold boolean not null default false,settings jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now());
create table if not exists public.sla_incidents(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id) on delete cascade,service text not null,severity text not null check(severity in ('minor','major','critical')),status text not null default 'open' check(status in ('open','monitoring','resolved')),started_at timestamptz not null default now(),resolved_at timestamptz,summary text not null,impact text,created_at timestamptz not null default now());
create index if not exists marketplace_listing_status_idx on public.marketplace_listings(status,published_at desc);create index if not exists webhook_delivery_queue_idx on public.webhook_deliveries(status,next_attempt_at);create index if not exists api_keys_org_idx on public.public_api_keys(organization_id,revoked_at);
alter table public.marketplace_listings enable row level security;alter table public.marketplace_listing_versions enable row level security;alter table public.marketplace_reviews enable row level security;alter table public.marketplace_moderation_cases enable row level security;alter table public.enterprise_org_units enable row level security;alter table public.sso_configurations enable row level security;alter table public.public_api_keys enable row level security;alter table public.webhook_endpoints enable row level security;alter table public.webhook_deliveries enable row level security;alter table public.usage_quotas enable row level security;alter table public.data_retention_policies enable row level security;alter table public.sla_incidents enable row level security;
create policy marketplace_public_read on public.marketplace_listings for select using(status='published' or public.is_org_member(organization_id));create policy marketplace_owner_write on public.marketplace_listings for all using(public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check(public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));create policy listing_versions_read on public.marketplace_listing_versions for select using(exists(select 1 from public.marketplace_listings l where l.id=listing_id and (l.status='published' or public.is_org_member(l.organization_id))));create policy listing_versions_write on public.marketplace_listing_versions for all using(exists(select 1 from public.marketplace_listings l where l.id=listing_id and public.has_org_role(l.organization_id,array['owner','admin']::public.member_role[]))) with check(true);
create policy marketplace_reviews_read on public.marketplace_reviews for select using(status='published' or reviewer_id=auth.uid());create policy marketplace_reviews_write on public.marketplace_reviews for all using(reviewer_id=auth.uid()) with check(reviewer_id=auth.uid());create policy moderation_admin on public.marketplace_moderation_cases for all using(public.is_platform_admin()) with check(public.is_platform_admin());
do $$ declare t text;begin foreach t in array array['enterprise_org_units','sso_configurations','public_api_keys','webhook_endpoints','webhook_deliveries','usage_quotas','data_retention_policies'] loop execute format('create policy %I_read on public.%I for select using(public.has_org_role(organization_id,array[''owner'',''admin'']::public.member_role[]))',t,t);execute format('create policy %I_write on public.%I for all using(public.has_org_role(organization_id,array[''owner'',''admin'']::public.member_role[])) with check(public.has_org_role(organization_id,array[''owner'',''admin'']::public.member_role[]))',t,t);end loop;end $$;
create policy sla_admin_read on public.sla_incidents for select using(organization_id is null or public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));create policy sla_platform_write on public.sla_incidents for all using(public.is_platform_admin()) with check(public.is_platform_admin());


-- ===== 0018_h2obook_v411_final_hardening.sql =====
-- H2OBOOK 4.11 final integration hardening
-- Encrypted webhook secrets, transactional delivery enqueue and public API usage accounting.

alter table public.webhook_endpoints add column if not exists secret_ciphertext text;
alter table public.webhook_deliveries add column if not exists last_error text;
alter table public.webhook_deliveries add column if not exists request_id uuid not null default gen_random_uuid();
alter table public.webhook_deliveries add column if not exists domain_event_id bigint references public.domain_events(id) on delete cascade;
create unique index if not exists webhook_delivery_endpoint_domain_event_unique on public.webhook_deliveries(endpoint_id,domain_event_id) where domain_event_id is not null;

create or replace function public.enqueue_domain_webhook_delivery()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.webhook_deliveries(organization_id,endpoint_id,domain_event_id,event_type,payload,status,next_attempt_at)
  select new.organization_id,e.id,new.id,
         case when position('.' in new.event_name)>0 then new.event_name else new.resource_type||'.'||new.event_name end,
         jsonb_build_object(
           'id',new.id,
           'organizationId',new.organization_id,
           'actorId',new.actor_id,
           'resourceType',new.resource_type,
           'resourceId',new.resource_id,
           'eventName',new.event_name,
           'payload',new.payload,
           'occurredAt',new.occurred_at
         ),
         'queued',now()
  from public.webhook_endpoints e
  where e.organization_id=new.organization_id
    and e.enabled=true
    and e.secret_ciphertext is not null
    and (
      '*'=any(e.events)
      or new.event_name=any(e.events)
      or (new.resource_type||'.'||new.event_name)=any(e.events)
    )
  on conflict(endpoint_id,domain_event_id) where domain_event_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists domain_event_webhook_enqueue on public.domain_events;
create trigger domain_event_webhook_enqueue after insert on public.domain_events
for each row execute function public.enqueue_domain_webhook_delivery();

create or replace function public.claim_webhook_deliveries(p_limit integer default 10)
returns setof public.webhook_deliveries
language plpgsql security definer set search_path=public as $$
begin
  return query
  with candidates as (
    select id from public.webhook_deliveries
    where status in ('queued','retry') and next_attempt_at<=now()
    order by next_attempt_at,created_at
    for update skip locked
    limit greatest(1,least(p_limit,100))
  )
  update public.webhook_deliveries d
  set status='sending',attempt_count=d.attempt_count+1
  from candidates c
  where d.id=c.id
  returning d.*;
end;
$$;

revoke all on function public.claim_webhook_deliveries(integer) from public,anon,authenticated;
grant execute on function public.claim_webhook_deliveries(integer) to service_role;


-- ===== 0019_h2obook_v4133_pdf_dual_import.sql =====
-- H2OBOOK 4.13.3 — PDF Dual Import
-- Add the semantic PDF reconstruction job while preserving all legacy document jobs.

alter table public.document_jobs
  drop constraint if exists document_jobs_job_type_check;

alter table public.document_jobs
  add constraint document_jobs_job_type_check
  check (job_type in ('pdf_import','pdf_reconstruct','docx_import','ocr','thumbnail','pdf_export','health_scan'));

create index if not exists document_jobs_pdf_reconstruct_idx
  on public.document_jobs (organization_id, created_at desc)
  where job_type = 'pdf_reconstruct';

comment on column public.document_jobs.job_type is
  'Document processing job. pdf_reconstruct converts native PDF text/images/tables into BookDocument; ocr is deterministic Tesseract fallback for scanned pages.';


-- ===== 0020_h2obook_v4134_image_smart_import.sql =====
-- H2OBOOK 4.13.4 — Image Smart Import
-- Stores deterministic image variants and region plans without introducing AI dependencies.

create table if not exists public.asset_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  variant_type text not null check (variant_type in ('thumbnail','preview','crop','print')),
  storage_key text not null unique,
  mime_type text not null,
  size_bytes bigint not null default 0,
  width integer,
  height integer,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(asset_id, variant_type, storage_key)
);

create table if not exists public.image_import_regions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  book_client_key text,
  region_kind text not null check (region_kind in ('text','image','ignore')),
  reading_order integer not null default 0,
  bounds jsonb not null,
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asset_variants enable row level security;
alter table public.image_import_regions enable row level security;

create policy "asset variants org read" on public.asset_variants for select
  using (public.is_org_member(organization_id));
create policy "asset variants editor write" on public.asset_variants for all
  using (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));
create policy "image regions org read" on public.image_import_regions for select
  using (public.is_org_member(organization_id));
create policy "image regions editor write" on public.image_import_regions for all
  using (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));

create index if not exists asset_variants_asset_idx on public.asset_variants(asset_id,variant_type);
create index if not exists image_import_regions_asset_idx on public.image_import_regions(asset_id,reading_order);

comment on table public.asset_variants is 'Generated image variants such as WebP thumbnails and manual crops.';
comment on table public.image_import_regions is 'Deterministic region plan used by Image Smart Import OCR/crop workflow.';

create or replace function public.replace_image_import_regions(
  p_organization_id uuid,
  p_asset_id uuid,
  p_book_client_key text,
  p_regions jsonb
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if not public.has_org_role(p_organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]) then
    raise exception 'WORKSPACE_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.assets
    where id = p_asset_id and organization_id = p_organization_id and deleted_at is null
  ) then
    raise exception 'ASSET_NOT_FOUND';
  end if;

  delete from public.image_import_regions
  where organization_id = p_organization_id and asset_id = p_asset_id;

  insert into public.image_import_regions(
    organization_id, asset_id, book_client_key, region_kind, reading_order,
    bounds, label, metadata, created_by
  )
  select
    p_organization_id,
    p_asset_id,
    p_book_client_key,
    case when item->>'kind' in ('text','image','ignore') then item->>'kind' else 'ignore' end,
    greatest(0, coalesce((item->>'order')::integer, ordinal::integer - 1)),
    jsonb_build_object(
      'x', greatest(0, coalesce((item->>'x')::numeric, 0)),
      'y', greatest(0, coalesce((item->>'y')::numeric, 0)),
      'width', greatest(1, coalesce((item->>'width')::numeric, 1)),
      'height', greatest(1, coalesce((item->>'height')::numeric, 1))
    ),
    nullif(left(coalesce(item->>'label',''),200),''),
    jsonb_build_object('clientRegionId', item->>'id'),
    auth.uid()
  from jsonb_array_elements(coalesce(p_regions,'[]'::jsonb)) with ordinality as region(item, ordinal);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.replace_image_import_regions(uuid,uuid,text,jsonb) to authenticated;


-- ===== 0021_h2obook_v4136_input_orchestrator.sql =====
-- H2OBOOK 4.13.6 — Unified Input Orchestrator, Preview, Commit, Retry and Recovery

create table if not exists public.input_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  source_format text not null check (source_format in ('docx','pdf','png','jpeg','html','markdown','txt','url')),
  import_mode text not null check (import_mode in ('fixed_layout','editable_content','asset','full_page','ocr','manual_regions')),
  status text not null default 'created' check (status in ('created','detected','validating','uploading','scanning','queued','processing','preview','correcting','committing','completed','recovery_required','failed','cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  source jsonb not null default '{}'::jsonb,
  destination jsonb not null default '{"type":"new_book"}'::jsonb,
  preview_document jsonb,
  corrections jsonb not null default '[]'::jsonb,
  design_payload jsonb,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  attempt integer not null default 0 check (attempt between 0 and 10),
  cancellation_requested boolean not null default false,
  retryable boolean not null default true,
  last_error_code text,
  last_error_message text,
  external_job_id text,
  target_book_id uuid references public.books(id) on delete set null,
  expected_document_version integer,
  commit_result jsonb,
  recovery_token_hash text,
  expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,idempotency_key)
);

create table if not exists public.input_session_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.input_sessions(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  status text not null,
  progress integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists input_sessions_org_updated_idx on public.input_sessions(organization_id,updated_at desc);
create index if not exists input_sessions_status_idx on public.input_sessions(organization_id,status,updated_at desc);
create index if not exists input_sessions_job_idx on public.input_sessions(external_job_id) where external_job_id is not null;
create index if not exists input_session_events_session_idx on public.input_session_events(session_id,occurred_at);

alter table public.input_sessions enable row level security;
alter table public.input_session_events enable row level security;

drop policy if exists input_sessions_member_select on public.input_sessions;
create policy input_sessions_member_select on public.input_sessions for select using (public.is_org_member(organization_id));
drop policy if exists input_sessions_editor_write on public.input_sessions;
create policy input_sessions_editor_write on public.input_sessions for all
  using (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));
drop policy if exists input_session_events_member_select on public.input_session_events;
create policy input_session_events_member_select on public.input_session_events for select using (public.is_org_member(organization_id));
drop policy if exists input_session_events_editor_insert on public.input_session_events;
create policy input_session_events_editor_insert on public.input_session_events for insert
  with check (public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[]));

-- Semantic parsers already emit table row/cell nodes. Keep database constraints aligned.
alter table public.content_nodes drop constraint if exists content_nodes_node_type_check;
alter table public.content_nodes add constraint content_nodes_node_type_check check (node_type in (
  'chapter','section','heading','paragraph','list','list_item','image','table','table_row','table_cell',
  'quote','quiz','footnote','citation','divider','callout','interactive'
));

create or replace function public.log_input_session_event(
  p_session_id uuid,
  p_event_name text,
  p_payload jsonb default '{}'::jsonb
) returns bigint language plpgsql security invoker set search_path=public as $$
declare v_session public.input_sessions; v_id bigint;
begin
  select * into v_session from public.input_sessions where id=p_session_id;
  if v_session.id is null or not public.is_org_member(v_session.organization_id) then raise exception 'INPUT_SESSION_NOT_FOUND'; end if;
  insert into public.input_session_events(organization_id,session_id,actor_id,event_name,status,progress,payload)
  values(v_session.organization_id,v_session.id,auth.uid(),p_event_name,v_session.status,v_session.progress,coalesce(p_payload,'{}'::jsonb)) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_input_session_event(uuid,text,jsonb) to authenticated;

create or replace function public.commit_input_session(
  p_session_id uuid,
  p_title text,
  p_language text,
  p_metadata jsonb,
  p_version integer,
  p_nodes jsonb,
  p_design_payload jsonb default null,
  p_client_key text default null,
  p_slug text default null
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_session public.input_sessions;
  v_book_id uuid;
  v_document_id uuid;
  v_document_version integer;
  v_destination text;
  v_client_key text;
  v_result jsonb;
  item jsonb;
begin
  select * into v_session from public.input_sessions where id=p_session_id for update;
  if v_session.id is null then raise exception 'INPUT_SESSION_NOT_FOUND'; end if;
  if not public.has_org_role(v_session.organization_id,array['owner','admin','designer']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_session.status='completed' then return coalesce(v_session.commit_result,'{}'::jsonb) || jsonb_build_object('alreadyCommitted',true); end if;
  if v_session.status not in ('preview','correcting','committing','recovery_required','failed') then raise exception 'INPUT_SESSION_NOT_COMMITTABLE'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(v_session.warnings,'[]'::jsonb)) w where w->>'severity'='error') then raise exception 'IMPORT_PREVIEW_BLOCKED'; end if;

  update public.input_sessions set status='committing',progress=95,updated_at=now(),last_error_code=null,last_error_message=null where id=v_session.id;
  v_destination:=coalesce(v_session.destination->>'type','new_book');
  v_client_key:=coalesce(nullif(p_client_key,''),'import-'||replace(v_session.id::text,'-',''));

  if v_destination='new_book' then
    insert into public.books(organization_id,owner_id,client_key,title,slug,status,current_version,updated_at)
    values(v_session.organization_id,auth.uid(),v_client_key,coalesce(nullif(p_title,''),'Tài liệu nhập'),coalesce(nullif(p_slug,''),'import-'||left(replace(v_session.id::text,'-',''),18)),'draft',1,now())
    on conflict(organization_id,client_key) where client_key is not null do update set updated_at=now()
    returning id into v_book_id;
  else
    v_book_id:=coalesce(v_session.target_book_id,nullif(v_session.destination->>'targetBookId','')::uuid);
    if v_book_id is null then raise exception 'INPUT_TARGET_BOOK_REQUIRED'; end if;
    if not exists(select 1 from public.books where id=v_book_id and organization_id=v_session.organization_id and deleted_at is null) then raise exception 'BOOK_NOT_FOUND'; end if;
  end if;

  if p_design_payload is not null then
    select public.save_book_document(v_session.organization_id,v_client_key,coalesce(nullif(p_slug,''),'import-'||left(replace(v_session.id::text,'-',''),18)),p_design_payload) into v_book_id;
    v_result:=jsonb_build_object('sessionId',v_session.id,'bookId',v_book_id,'clientKey',v_client_key,'destination',v_destination,'committedAt',now(),'openPath','/editor/'||v_client_key);
  else
    select version into v_document_version from public.book_documents where book_id=v_book_id for update;
    if v_session.expected_document_version is not null and coalesce(v_document_version,0)<>v_session.expected_document_version then raise exception 'INPUT_VERSION_CONFLICT'; end if;

    insert into public.book_documents(organization_id,book_id,title,language,metadata,version,created_by)
    values(v_session.organization_id,v_book_id,coalesce(nullif(p_title,''),'Tài liệu nhập'),coalesce(nullif(p_language,''),'vi'),coalesce(p_metadata,'{}'::jsonb),greatest(coalesce(p_version,1),coalesce(v_document_version,0)+1),auth.uid())
    on conflict(book_id) do update set title=excluded.title,language=excluded.language,metadata=excluded.metadata,version=excluded.version,updated_at=now()
    returning id,version into v_document_id,v_document_version;

    delete from public.content_nodes where document_id=v_document_id;
    for item in select value from jsonb_array_elements(coalesce(p_nodes,'[]'::jsonb)) loop
      insert into public.content_nodes(id,organization_id,document_id,parent_id,node_type,position,text_content,attrs,version)
      values((item->>'id')::uuid,v_session.organization_id,v_document_id,nullif(item->>'parentId','')::uuid,item->>'type',coalesce((item->>'position')::integer,0),coalesce(item->'text','[]'::jsonb),coalesce(item->'attrs','{}'::jsonb),greatest(coalesce((item->>'version')::integer,1),1));
    end loop;
    update public.books set title=coalesce(nullif(p_title,''),title),updated_at=now() where id=v_book_id;
    v_result:=jsonb_build_object('sessionId',v_session.id,'bookId',v_book_id,'clientKey',coalesce((select client_key from public.books where id=v_book_id),v_client_key),'documentId',v_document_id,'documentVersion',v_document_version,'destination',v_destination,'committedAt',now(),'openPath','/editor/'||coalesce((select client_key from public.books where id=v_book_id),v_book_id::text)||'?mode=compose');
  end if;

  update public.input_sessions set status='completed',progress=100,target_book_id=v_book_id,commit_result=v_result,completed_at=now(),updated_at=now(),retryable=false where id=v_session.id;
  insert into public.input_session_events(organization_id,session_id,actor_id,event_name,status,progress,payload)
  values(v_session.organization_id,v_session.id,auth.uid(),'session.completed','completed',100,v_result);
  insert into public.domain_events(organization_id,actor_id,resource_type,resource_id,event_name,payload)
  values(v_session.organization_id,auth.uid(),'input_session',v_session.id,'input.committed',v_result);
  insert into public.analytics_events(event_id,organization_id,user_id,event_name,resource_type,resource_id,resource_client_key,properties,occurred_at)
  values(gen_random_uuid(),v_session.organization_id,auth.uid(),'input_committed','book',v_book_id,coalesce(v_result->>'clientKey',v_book_id::text),jsonb_build_object('format',v_session.source_format,'mode',v_session.import_mode,'destination',v_destination,'sessionId',v_session.id),now());
  return v_result;
exception when others then
  update public.input_sessions set status='recovery_required',progress=95,retryable=true,last_error_code=sqlstate,last_error_message=sqlerrm,updated_at=now() where id=p_session_id and status<>'completed';
  insert into public.input_session_events(organization_id,session_id,actor_id,event_name,status,progress,payload)
  select organization_id,id,auth.uid(),'session.commit_recovery_required','recovery_required',95,jsonb_build_object('code',sqlstate,'message',sqlerrm) from public.input_sessions where id=p_session_id;
  return jsonb_build_object('error',sqlerrm,'code',sqlstate,'recoveryRequired',true,'sessionId',p_session_id);
end;
$$;

grant execute on function public.commit_input_session(uuid,text,text,jsonb,integer,jsonb,jsonb,text,text) to authenticated;

-- Realtime enables recovery from another tab/device.
do $$ begin
  begin alter publication supabase_realtime add table public.input_sessions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.input_session_events; exception when duplicate_object then null; end;
end $$;


-- ===== 0022_h2obook_v4137_production_hardening.sql =====
-- H2OBOOK 4.13.7 — Production Validation & Hardening

alter table public.input_sessions add column if not exists trace_id text;
alter table public.input_sessions add column if not exists heartbeat_at timestamptz;
alter table public.input_sessions add column if not exists processing_deadline_at timestamptz;
alter table public.input_sessions add column if not exists lease_owner text;
alter table public.input_sessions add column if not exists metrics jsonb not null default '{}'::jsonb;
alter table public.input_sessions add column if not exists security_summary jsonb not null default '{}'::jsonb;
alter table public.input_session_events add column if not exists trace_id text;

update public.input_sessions
set trace_id = coalesce(trace_id, 'itr_' || replace(id::text,'-','')),
    heartbeat_at = coalesce(heartbeat_at, updated_at),
    processing_deadline_at = coalesce(processing_deadline_at, updated_at + interval '45 minutes')
where trace_id is null or heartbeat_at is null or processing_deadline_at is null;

alter table public.input_sessions alter column trace_id set not null;
create unique index if not exists input_sessions_trace_id_idx on public.input_sessions(trace_id);
create index if not exists input_sessions_recovery_idx on public.input_sessions(status,heartbeat_at,processing_deadline_at)
  where status in ('queued','processing','committing');
create index if not exists input_session_events_trace_idx on public.input_session_events(trace_id,occurred_at desc) where trace_id is not null;

alter table public.input_sessions drop constraint if exists input_sessions_attempt_hardened_check;
alter table public.input_sessions add constraint input_sessions_attempt_hardened_check check (attempt between 0 and 5) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_preview_size_check;
alter table public.input_sessions add constraint input_sessions_preview_size_check check (preview_document is null or pg_column_size(preview_document) <= 31457280) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_corrections_size_check;
alter table public.input_sessions add constraint input_sessions_corrections_size_check check (pg_column_size(corrections) <= 6291456) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_design_size_check;
alter table public.input_sessions add constraint input_sessions_design_size_check check (design_payload is null or pg_column_size(design_payload) <= 62914560) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_metadata_size_check;
alter table public.input_sessions add constraint input_sessions_metadata_size_check check (pg_column_size(metadata) <= 3145728) not valid;
alter table public.input_sessions drop constraint if exists input_sessions_warning_size_check;
alter table public.input_sessions add constraint input_sessions_warning_size_check check (pg_column_size(warnings) <= 2097152) not valid;

create or replace function public.guard_input_session_payload()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.requested_by <> old.requested_by or new.idempotency_key <> old.idempotency_key) then
    raise exception 'INPUT_SESSION_IDENTITY_IMMUTABLE';
  end if;
  new.updated_at := now();
  new.trace_id := coalesce(nullif(new.trace_id,''), 'itr_' || replace(new.id::text,'-',''));
  new.heartbeat_at := coalesce(new.heartbeat_at, now());
  if new.processing_deadline_at is null then new.processing_deadline_at := now() + interval '45 minutes'; end if;
  if length(coalesce(new.idempotency_key,'')) > 240 then raise exception 'INPUT_IDEMPOTENCY_KEY_TOO_LONG'; end if;
  if pg_column_size(new.source) > 2097152 then raise exception 'INPUT_SOURCE_METADATA_TOO_LARGE'; end if;
  if pg_column_size(new.destination) > 65536 then raise exception 'INPUT_DESTINATION_TOO_LARGE'; end if;
  if jsonb_typeof(new.corrections) <> 'array' then raise exception 'INPUT_CORRECTIONS_INVALID'; end if;
  if jsonb_array_length(new.corrections) > 5000 then raise exception 'INPUT_CORRECTION_LIMIT_EXCEEDED'; end if;
  return new;
end;
$$;

drop trigger if exists guard_input_session_payload_trigger on public.input_sessions;
create trigger guard_input_session_payload_trigger before insert or update on public.input_sessions
for each row execute function public.guard_input_session_payload();

-- Do not allow browser clients to mutate another member's sessions or change organization/requester fields.
drop policy if exists input_sessions_editor_write on public.input_sessions;
drop policy if exists input_sessions_creator_insert on public.input_sessions;
create policy input_sessions_creator_insert on public.input_sessions for insert
  with check (
    requested_by = auth.uid()
    and public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[])
  );
drop policy if exists input_sessions_owner_update on public.input_sessions;
create policy input_sessions_owner_update on public.input_sessions for update
  using (
    public.has_org_role(organization_id,array['owner','admin']::public.member_role[])
    or (requested_by = auth.uid() and public.has_org_role(organization_id,array['designer','partner','teacher']::public.member_role[]))
  )
  with check (
    public.has_org_role(organization_id,array['owner','admin']::public.member_role[])
    or (requested_by = auth.uid() and public.has_org_role(organization_id,array['designer','partner','teacher']::public.member_role[]))
  );

drop policy if exists input_session_events_editor_insert on public.input_session_events;
create policy input_session_events_editor_insert on public.input_session_events for insert
  with check (
    actor_id = auth.uid()
    and public.has_org_role(organization_id,array['owner','admin','designer','partner','teacher']::public.member_role[])
    and exists(select 1 from public.input_sessions s where s.id=session_id and s.organization_id=organization_id)
  );

create or replace function public.touch_input_session(
  p_session_id uuid,
  p_progress integer default null,
  p_metrics jsonb default '{}'::jsonb,
  p_lease_owner text default null
) returns boolean language plpgsql security invoker set search_path=public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.input_sessions where id=p_session_id;
  if v_org is null then return false; end if;
  if auth.role() <> 'service_role' and not public.has_org_role(v_org,array['owner','admin','designer','partner','teacher']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  update public.input_sessions
  set heartbeat_at=now(), progress=coalesce(greatest(progress,least(99,greatest(0,p_progress))),progress),
      metrics=coalesce(metrics,'{}'::jsonb)||coalesce(p_metrics,'{}'::jsonb), lease_owner=coalesce(p_lease_owner,lease_owner), updated_at=now()
  where id=p_session_id and status not in ('completed','cancelled');
  return found;
end;
$$;
grant execute on function public.touch_input_session(uuid,integer,jsonb,text) to authenticated,service_role;

create or replace function public.commit_input_session_hardened(
  p_session_id uuid,
  p_title text,
  p_language text,
  p_metadata jsonb,
  p_version integer,
  p_nodes jsonb,
  p_design_payload jsonb default null,
  p_client_key text default null,
  p_slug text default null
) returns jsonb language plpgsql security invoker set search_path=public as $$
begin
  if length(coalesce(p_title,'')) > 500 then raise exception 'INPUT_TITLE_TOO_LONG'; end if;
  if jsonb_typeof(coalesce(p_nodes,'[]'::jsonb)) <> 'array' then raise exception 'IMPORT_NODES_INVALID'; end if;
  if jsonb_array_length(coalesce(p_nodes,'[]'::jsonb)) > 50000 then raise exception 'IMPORT_NODE_LIMIT_EXCEEDED'; end if;
  if pg_column_size(coalesce(p_nodes,'[]'::jsonb)) > 31457280 then raise exception 'IMPORT_NODES_TOO_LARGE'; end if;
  if pg_column_size(coalesce(p_metadata,'{}'::jsonb)) > 2097152 then raise exception 'IMPORT_METADATA_TOO_LARGE'; end if;
  if p_design_payload is not null and pg_column_size(p_design_payload) > 62914560 then raise exception 'INPUT_DESIGN_PAYLOAD_TOO_LARGE'; end if;
  return public.commit_input_session(p_session_id,p_title,p_language,p_metadata,p_version,p_nodes,p_design_payload,p_client_key,p_slug);
end;
$$;
grant execute on function public.commit_input_session_hardened(uuid,text,text,jsonb,integer,jsonb,jsonb,text,text) to authenticated;

create or replace function public.recover_stale_input_sessions(p_limit integer default 100)
returns table(session_id uuid, organization_id uuid, previous_status text, error_code text)
language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  return query
  with candidates as (
    select id,organization_id,status
    from public.input_sessions
    where status in ('queued','processing','committing')
      and (
        processing_deadline_at < now()
        or heartbeat_at < now() - interval '5 minutes'
      )
    order by updated_at
    limit least(greatest(p_limit,1),500)
    for update skip locked
  ), updated as (
    update public.input_sessions s
    set status='recovery_required', retryable=true, lease_owner=null,
        last_error_code=case when s.processing_deadline_at < now() then 'INPUT_PROCESSING_TIMEOUT' else 'INPUT_HEARTBEAT_STALE' end,
        last_error_message='Phiên nhập bị gián đoạn và đã được chuyển sang trạng thái khôi phục.', updated_at=now()
    from candidates c where s.id=c.id
    returning s.id,s.organization_id,c.status,s.last_error_code,s.trace_id,s.progress
  ), events as (
    insert into public.input_session_events(organization_id,session_id,event_name,status,progress,trace_id,payload)
    select u.organization_id,u.id,'session.recovery_required','recovery_required',u.progress,u.trace_id,jsonb_build_object('errorCode',u.last_error_code,'source','stale-session-sweeper')
    from updated u returning session_id
  )
  select u.id,u.organization_id,u.status,u.last_error_code from updated u;
end;
$$;
revoke all on function public.recover_stale_input_sessions(integer) from public,anon,authenticated;
grant execute on function public.recover_stale_input_sessions(integer) to service_role;

comment on function public.recover_stale_input_sessions(integer) is 'Service-role sweeper for timed-out or heartbeat-stale input sessions.';


-- ===== 0023_h2obook_v4141_student_storage_quota.sql =====
-- H2OBOOK 4.14.1 — Per-student storage quota for self-service Design Library

alter table public.organization_members add column if not exists storage_quota_bytes bigint;

create index if not exists assets_org_uploader_idx on public.assets (organization_id, uploaded_by);

comment on column public.organization_members.storage_quota_bytes is
  'Optional per-membership storage cap in bytes. Null falls back to the role-based default in lib/storage/quota.ts (students only; other roles remain unlimited).';


-- ===== 0024_h2obook_v416_academy_revenue_loop.sql =====
-- H2OBOOK V4.16 Academy revenue loop
-- Public application -> admin approval -> Auth invite -> entitlement -> lesson progress.
begin;

alter table public.profiles add column if not exists email text;
create unique index if not exists profiles_email_unique on public.profiles(lower(email)) where email is not null;

alter table public.products drop constraint if exists products_product_type_check;
alter table public.products add constraint products_product_type_check
  check (product_type in ('book','template','course','membership','bundle'));

create table if not exists public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  category text not null default '',
  level text not null default '',
  duration_label text not null default '',
  format text not null default 'Online',
  price numeric(14,2) not null default 0,
  currency text not null default 'VND',
  accent text not null default '',
  outcomes text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','active','hidden','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug)
);

create table if not exists public.academy_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id,slug)
);

create table if not exists public.academy_course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_course_modules(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  video_provider text not null default 'cloudflare_stream' check (video_provider in ('cloudflare_stream','direct','embed','none')),
  video_playback_id text,
  video_url text,
  transcript_asset_id uuid references public.assets(id) on delete set null,
  content jsonb not null default '{}'::jsonb,
  skill_keys text[] not null default '{}',
  is_preview boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_id,slug)
);

create table if not exists public.academy_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_type text not null check (target_type in ('course','membership')),
  target_slug text not null,
  target_name text not null,
  name text not null,
  email text not null check (email=lower(email)),
  phone text,
  message text,
  status text not null default 'new' check (status in ('new','approved','invited','converted','rejected')),
  source text not null default 'academy_public',
  utm jsonb not null default '{}'::jsonb,
  consent jsonb not null default '{}'::jsonb,
  auth_user_id uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.academy_course_lessons(id) on delete cascade,
  completed boolean not null default false,
  watch_seconds integer not null default 0 check (watch_seconds >= 0),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  started_at timestamptz not null default now(),
  last_watched_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,lesson_id)
);

create table if not exists public.academy_skill_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  skill_key text not null,
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  evidence_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id,course_id,skill_key)
);

create table if not exists public.transactional_email_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  recipient text not null,
  template_key text not null,
  dedupe_key text not null,
  provider text,
  provider_message_id text,
  status text not null default 'sent' check (status in ('sent','failed','skipped')),
  error_message text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(template_key,dedupe_key)
);

create index if not exists academy_applications_org_status_idx on public.academy_applications(organization_id,status,created_at desc);
create index if not exists academy_applications_email_idx on public.academy_applications(lower(email),created_at desc);
create unique index if not exists academy_applications_open_unique on public.academy_applications(organization_id,lower(email),target_type,target_slug)
  where status in ('new','approved','invited');
create index if not exists academy_modules_course_position_idx on public.academy_course_modules(course_id,position);
create index if not exists academy_lessons_module_position_idx on public.academy_course_lessons(module_id,position);
create index if not exists academy_progress_user_recent_idx on public.academy_lesson_progress(user_id,last_watched_at desc);
create index if not exists academy_skill_user_idx on public.academy_skill_progress(user_id,updated_at desc);
create index if not exists transactional_email_recipient_idx on public.transactional_email_log(recipient,sent_at desc);

alter table public.academy_courses enable row level security;
alter table public.academy_course_modules enable row level security;
alter table public.academy_course_lessons enable row level security;
alter table public.academy_applications enable row level security;
alter table public.academy_lesson_progress enable row level security;
alter table public.academy_skill_progress enable row level security;
alter table public.transactional_email_log enable row level security;

create policy "academy courses public read" on public.academy_courses for select
  using (status='active' or public.is_org_member(organization_id));
create policy "academy courses admin write" on public.academy_courses for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "academy modules public read" on public.academy_course_modules for select
  using (status='published' or exists(select 1 from public.academy_courses c where c.id=course_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "academy modules admin write" on public.academy_course_modules for all
  using (exists(select 1 from public.academy_courses c where c.id=course_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])))
  with check (exists(select 1 from public.academy_courses c where c.id=course_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "academy lessons entitled read" on public.academy_course_lessons for select using (
  is_preview or exists(
    select 1 from public.academy_course_modules m join public.academy_courses c on c.id=m.course_id
    where m.id=module_id and (
      public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[]) or
      exists(select 1 from public.entitlements e where e.user_id=auth.uid() and e.organization_id=c.organization_id and e.status='active' and (e.expires_at is null or e.expires_at>now()) and ((e.resource_type='course' and e.resource_id=c.id) or e.resource_type='membership'))
    )
  )
);
create policy "academy lessons admin write" on public.academy_course_lessons for all
  using (exists(select 1 from public.academy_course_modules m join public.academy_courses c on c.id=m.course_id where m.id=module_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])))
  with check (exists(select 1 from public.academy_course_modules m join public.academy_courses c on c.id=m.course_id where m.id=module_id and public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])));
create policy "academy applications admin read" on public.academy_applications for select
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "academy applications admin manage" on public.academy_applications for all
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "academy progress self read" on public.academy_lesson_progress for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "academy progress self write" on public.academy_lesson_progress for all
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "academy skill self read" on public.academy_skill_progress for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "academy skill self write" on public.academy_skill_progress for all
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "transactional email admin read" on public.transactional_email_log for select
  using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create or replace function public.refresh_academy_skill_progress()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_user_id uuid;
  v_lesson_id uuid;
  v_org_id uuid;
  v_course_id uuid;
  v_skill text;
  v_total integer;
  v_completed integer;
begin
  if tg_op='DELETE' then
    v_user_id := old.user_id;
    v_lesson_id := old.lesson_id;
  else
    v_user_id := new.user_id;
    v_lesson_id := new.lesson_id;
  end if;
  select c.organization_id,c.id into v_org_id,v_course_id
  from public.academy_course_lessons l
  join public.academy_course_modules m on m.id=l.module_id
  join public.academy_courses c on c.id=m.course_id
  where l.id=v_lesson_id;
  if v_course_id is null then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  for v_skill in select distinct unnest(l.skill_keys) from public.academy_course_lessons l where l.id=v_lesson_id loop
    select count(*) into v_total from public.academy_course_lessons l
      join public.academy_course_modules m on m.id=l.module_id
      where m.course_id=v_course_id and v_skill=any(l.skill_keys) and l.status='published';
    select count(*) into v_completed from public.academy_lesson_progress p
      join public.academy_course_lessons l on l.id=p.lesson_id
      join public.academy_course_modules m on m.id=l.module_id
      where p.user_id=v_user_id and p.completed and m.course_id=v_course_id and v_skill=any(l.skill_keys);
    insert into public.academy_skill_progress(organization_id,user_id,course_id,skill_key,progress_percent,evidence_count,updated_at)
      values(v_org_id,v_user_id,v_course_id,v_skill,case when v_total=0 then 0 else round(v_completed::numeric*100/v_total,2) end,v_completed,now())
      on conflict(user_id,course_id,skill_key) do update set progress_percent=excluded.progress_percent,evidence_count=excluded.evidence_count,updated_at=now();
  end loop;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists refresh_academy_skill_progress_trigger on public.academy_lesson_progress;
create trigger refresh_academy_skill_progress_trigger
after insert or update of completed or delete on public.academy_lesson_progress
for each row execute function public.refresh_academy_skill_progress();

-- Keep profile email in sync so reminders and CRM joins never need direct auth schema access.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid;
  v_name text;
  v_slug text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '');
  insert into public.profiles(id,email,full_name,avatar_url)
  values(new.id,lower(new.email),coalesce(v_name,''),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,avatar_url=excluded.avatar_url,updated_at=now();
  if coalesce(new.raw_user_meta_data->>'role','owner')='owner' and not exists(select 1 from public.organization_members where user_id=new.id) then
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(v_name,split_part(new.email,'@',1),'h2obook')), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(new.id::text,'-',''),1,8);
    insert into public.organizations(name,slug,owner_id) values(coalesce(v_name,'H2OBOOK Workspace'),v_slug,new.id) returning id into v_org_id;
    insert into public.organization_members(organization_id,user_id,role,status) values(v_org_id,new.id,'owner','active');
  end if;
  return new;
end;
$$;

update public.profiles p set email=lower(u.email) from auth.users u where u.id=p.id and p.email is null;

commit;


-- ===== 0025_h2obook_operations_foundation.sql =====
-- H2OBOOK Operations Expansion Foundation
-- Revised from optional/supabase/0023_h2obook_operations_expansion_optional.sql shipped with the
-- H2OBOOK-OPERATIONS-EXPANSION-FOUNDATION-MODULE: adds organization_id scoping consistent with the
-- rest of the schema, RLS policies built on the existing public.has_org_role/is_org_member helpers,
-- and updated_at maintenance triggers. Not auto-applied; run only after review.
--
-- Role note: admissions/support/finance/content_manager/platform_admin are part of the Operations
-- Foundation's application-level role model (types/operations.ts) but are NOT part of the
-- public.member_role enum (0001_h2obook_core.sql: owner, admin, designer, partner, teacher,
-- student). Until a follow-up migration extends that enum, these tables are only readable/writable
-- by owner/admin at the database layer; app-layer route guards mirror this in
-- lib/operations/role-bridge.ts and app/operations/layout.tsx.
begin;

create table if not exists public.admission_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  source text not null default 'manual',
  interest text not null default '',
  stage text not null default 'new' check (stage in ('new','contacted','consulted','qualified','deposit','paid','enrolled','lost')),
  owner_id uuid references auth.users(id) on delete set null,
  next_action_at timestamptz,
  expected_value bigint not null default 0,
  notes text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.admission_leads(id) on delete set null,
  customer_user_id uuid references auth.users(id) on delete set null,
  program_name text not null,
  profile_completion int not null default 0 check (profile_completion between 0 and 100),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','deposit','paid','refunded')),
  onboarding_stage text not null default 'application' check (onboarding_stage in ('application','documents','payment','class_assignment','account_provisioning','completed')),
  class_id uuid,
  account_provisioned boolean not null default false,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_name text not null,
  requester_type text not null check (requester_type in ('lead','customer','student','instructor','staff')),
  category text not null check (category in ('account','payment','course','assignment','technical','policy')),
  subject text not null,
  description text not null default '',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_customer','resolved','closed')),
  assignee_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_type text not null check (request_type in ('book','course','lesson','landing','design','graduation','certificate','marketplace')),
  title text not null,
  resource_type text,
  resource_id text,
  requester_id uuid references auth.users(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','rejected')),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  decision_note text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operations_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_type text not null check (import_type in ('leads','students','payments','classes','scores')),
  asset_id uuid references public.assets(id) on delete set null,
  file_name text not null,
  mapping jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  row_count int not null default 0,
  valid_rows int not null default 0,
  invalid_rows int not null default 0,
  status text not null default 'draft' check (status in ('draft','validating','ready','processing','completed','failed','rolled_back')),
  rollback_payload jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.certificate_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  certificate_no text not null,
  verification_token text not null,
  student_id uuid references public.profiles(id) on delete set null,
  student_name text not null,
  course_name text not null,
  instructor_name text not null,
  status text not null default 'valid' check (status in ('valid','revoked','expired')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id, certificate_no),
  unique (verification_token)
);

create index if not exists admission_leads_org_stage_idx on public.admission_leads(organization_id,stage,updated_at desc);
create index if not exists customer_applications_org_stage_idx on public.customer_applications(organization_id,onboarding_stage,updated_at desc);
create index if not exists customer_applications_user_idx on public.customer_applications(customer_user_id);
create index if not exists support_tickets_org_status_idx on public.support_tickets(organization_id,status,updated_at desc);
create index if not exists approval_requests_org_status_idx on public.approval_requests(organization_id,status,due_at);
create index if not exists operations_import_jobs_org_idx on public.operations_import_jobs(organization_id,created_at desc);
create index if not exists certificate_issues_org_idx on public.certificate_issues(organization_id,issued_at desc);

alter table public.admission_leads enable row level security;
alter table public.customer_applications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.approval_requests enable row level security;
alter table public.operations_import_jobs enable row level security;
alter table public.certificate_issues enable row level security;

create policy "admission leads staff manage" on public.admission_leads for all
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "customer applications staff manage" on public.customer_applications for all
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "customer applications self read" on public.customer_applications for select
  using (customer_user_id=auth.uid());

create policy "support tickets staff manage" on public.support_tickets for all
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy "support tickets self read" on public.support_tickets for select
  using (requester_user_id=auth.uid());

create policy "approval requests staff manage" on public.approval_requests for all
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "operations import jobs staff manage" on public.operations_import_jobs for all
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "certificate issues staff manage" on public.certificate_issues for all
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
-- Certificate verification (/verify/[certificateNo]) is public and read-only; it must read through
-- a narrow server-side lookup (service role or a dedicated SECURITY DEFINER function) that returns
-- only certificate_no/student_name/course_name/instructor_name/issued_at/status, never
-- verification_token or organization_id. No public SELECT policy is granted on this table.

-- Reuses public.touch_updated_at(), already defined in 0007_h2obook_v41_production_foundation.sql.
drop trigger if exists admission_leads_touch_updated_at on public.admission_leads;
create trigger admission_leads_touch_updated_at before update on public.admission_leads
for each row execute function public.touch_updated_at();

drop trigger if exists customer_applications_touch_updated_at on public.customer_applications;
create trigger customer_applications_touch_updated_at before update on public.customer_applications
for each row execute function public.touch_updated_at();

drop trigger if exists support_tickets_touch_updated_at on public.support_tickets;
create trigger support_tickets_touch_updated_at before update on public.support_tickets
for each row execute function public.touch_updated_at();

drop trigger if exists approval_requests_touch_updated_at on public.approval_requests;
create trigger approval_requests_touch_updated_at before update on public.approval_requests
for each row execute function public.touch_updated_at();

commit;


-- ===== 0026_h2obook_learning_intelligence_v3.sql =====
-- H2OBOOK Learning Intelligence V3 — Brain Learning Engine (adapter migration)
-- Source module: v5/8-h2obook-learning-intelligence-v3-final. This is an ADDITIVE, adapted
-- migration (Case C in the module's own CLAUDE_MAIN_INTEGRATION_PROMPT.md): it does NOT reuse
-- CONSOLIDATED_SCHEMA_V3.sql wholesale, because this repository already has an equivalent
-- Learning Commerce base (products/orders/order_items/memberships/entitlements from
-- 0002_h2obook_v2_integrated.sql, and academy_courses/academy_course_modules/
-- academy_course_lessons from 0024_h2obook_v416_academy_revenue_loop.sql). Only the genuinely
-- new "Brain Learning" layer (Knowledge Space authoring, Brain Map, Experience Vault, grading,
-- Journal, Result/Share, Brain Assistant search) is added here, wired to the existing schema:
--   ContentItem (V3 concept)  -> public.academy_course_lessons (existing)
--   Roadmap/Product/Membership/Entitlement (V3 concept) -> already implemented, reused as-is
-- pgvector/embedding is deferred (see knowledge_chunks below); keyword search_text ships now.
begin;

create type public.knowledge_space_type as enum (
  'video_course','interactive_checklist','digital_textbook','resource_vault','practice_lab',
  'case_library','tool_workspace','live_program','assessment','coaching_space'
);
create type public.knowledge_space_version_status as enum (
  'draft','review','scheduled','published','superseded','archived'
);
create type public.learning_block_type as enum (
  'mission_brief','rich_text','video','image','gallery','audio','download','expert_insight',
  'warning','flashcards','process','timeline','knowledge_map','case_study','before_after',
  'checklist','quiz','assignment','reflection','tool_embed','result','share_card'
);
create type public.learning_block_visibility as enum ('all_entitled','preview','instructor','admin');
create type public.completion_condition_type as enum (
  'view_block','watch_video_percent','complete_checklist_percent','pass_quiz','submit_assignment','receive_grade','manual'
);
create type public.experience_visibility as enum ('private','instructor','class','community');
create type public.experience_moderation_status as enum ('draft','submitted','approved','rejected');
create type public.submission_status as enum ('draft','submitted','in_review','revision_requested','graded');
create type public.journal_entry_type as enum ('note','bookmark','reflection','experience','result','question');
create type public.share_channel as enum ('facebook','copy','download','portfolio','public_link');

-- ---------------------------------------------------------------------------
-- Knowledge Space authoring
-- ---------------------------------------------------------------------------

create table public.knowledge_spaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.academy_course_lessons(id) on delete cascade,
  code text not null,
  slug text not null,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  space_type public.knowledge_space_type not null default 'digital_textbook',
  difficulty text not null default 'beginner' check (difficulty in ('beginner','intermediate','advanced','professional')),
  status public.book_status not null default 'draft',
  active_version_id uuid,
  template_id uuid,
  instructor_name text not null default '',
  estimated_minutes integer not null default 0,
  thumbnail_asset_id uuid references public.assets(id) on delete set null,
  hero_style text not null default 'brain' check (hero_style in ('brain','editorial','studio','minimal')),
  assistant_enabled boolean not null default true,
  community_enabled boolean not null default false,
  certificate_enabled boolean not null default false,
  sharing_enabled boolean not null default true,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,slug),
  unique(organization_id,code),
  unique(content_item_id)
);

create table public.knowledge_space_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  version_number integer not null,
  status public.knowledge_space_version_status not null default 'draft',
  title text not null default '',
  changelog text not null default '',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(knowledge_space_id,version_number)
);

alter table public.knowledge_spaces
  add constraint knowledge_spaces_active_version_fk
  foreign key (active_version_id) references public.knowledge_space_versions(id) on delete set null;

create table public.learning_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  icon text not null default '',
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  section_id uuid not null references public.learning_sections(id) on delete cascade,
  block_type public.learning_block_type not null,
  title text not null default '',
  position integer not null default 0,
  visibility public.learning_block_visibility not null default 'all_entitled',
  required boolean not null default true,
  estimated_minutes integer not null default 0,
  completion_weight numeric(6,2) not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  title text not null,
  description text not null default '',
  icon text not null default '',
  position_x numeric(10,3) not null default 0,
  position_y numeric(10,3) not null default 0,
  linked_section_ids uuid[] not null default '{}',
  prerequisite_node_ids uuid[] not null default '{}',
  mastery_weight numeric(6,2) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  source_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  target_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  label text not null default '',
  created_at timestamptz not null default now()
);

create table public.completion_conditions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  condition_type public.completion_condition_type not null,
  target_id uuid,
  threshold numeric(6,2),
  required boolean not null default true,
  label text not null default '',
  created_at timestamptz not null default now()
);

create table public.brain_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  description text not null default '',
  space_type public.knowledge_space_type not null default 'digital_textbook',
  default_blocks jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('draft','published','archived','active')),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code)
);

alter table public.knowledge_spaces
  add constraint knowledge_spaces_template_fk
  foreign key (template_id) references public.brain_templates(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Experience Vault, assignments and grading
-- ---------------------------------------------------------------------------

create table public.experience_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  summary text not null default '',
  knowledge_space_ids uuid[] not null default '{}',
  author_type text not null check (author_type in ('instructor','student','staff')),
  author_id uuid not null references public.profiles(id) on delete cascade,
  visibility public.experience_visibility not null default 'private',
  moderation_status public.experience_moderation_status not null default 'draft',
  context text not null default '',
  challenge text not null default '',
  customer_request text not null default '',
  analysis text not null default '',
  solution text not null default '',
  products_used text[] not null default '{}',
  mistakes text[] not null default '{}',
  lessons_learned text[] not null default '{}',
  before_asset_id uuid references public.assets(id) on delete set null,
  after_asset_id uuid references public.assets(id) on delete set null,
  video_asset_id uuid references public.assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code)
);

create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rubric_id uuid not null references public.rubrics(id) on delete cascade,
  title text not null,
  description text not null default '',
  max_score numeric(6,2) not null default 10,
  position integer not null default 0
);

create table public.assignment_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  block_id uuid references public.learning_blocks(id) on delete set null,
  title text not null,
  instructions text not null default '',
  submission_types text[] not null default '{text}',
  max_score numeric(6,2) not null default 100,
  passing_score numeric(6,2) not null default 70,
  rubric_id uuid references public.rubrics(id) on delete set null,
  allow_resubmission boolean not null default true,
  peer_sharing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Named brain_assignment_submissions (not assignment_submissions) because 0002 already defined
-- public.assignment_submissions against the older, unrelated public.assignments table
-- (student_id/assignment_id, no organization_id/knowledge_space linkage). Reusing that name
-- here previously caused "relation already exists" and rolled back this entire migration.
create table public.brain_assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null references public.assignment_definitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.submission_status not null default 'draft',
  text_response text not null default '',
  asset_ids uuid[] not null default '{}',
  score numeric(6,2),
  instructor_feedback text,
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brain_assignment_submissions_grading_idx on public.brain_assignment_submissions(organization_id,status,submitted_at);

-- ---------------------------------------------------------------------------
-- Learner space: progress, notes, experiences, results, sharing, journal
-- ---------------------------------------------------------------------------

create table public.block_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  block_id uuid not null references public.learning_blocks(id) on delete cascade,
  percent numeric(5,2) not null default 0 check (percent between 0 and 100),
  completed_at timestamptz,
  last_position_seconds integer,
  response jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id,block_id)
);

create table public.knowledge_space_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  percent numeric(5,2) not null default 0 check (percent between 0 and 100),
  mastery_percent numeric(5,2) not null default 0,
  practice_percent numeric(5,2) not null default 0,
  confidence_percent numeric(5,2) not null default 0,
  status text not null default 'not_started' check (status in ('not_started','in_progress','waiting_feedback','completed','needs_review')),
  last_block_id uuid references public.learning_blocks(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id,knowledge_space_id)
);

create table public.learner_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  block_id uuid references public.learning_blocks(id) on delete set null,
  lesson_timestamp_seconds integer,
  title text not null default '',
  body text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learner_experiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  title text not null,
  performed_at timestamptz not null default now(),
  subject_profile text not null default '',
  condition_analysis text not null default '',
  desired_outcome text not null default '',
  steps_taken text not null default '',
  products_used text[] not null default '{}',
  challenges text not null default '',
  solution text not null default '',
  learning text not null default '',
  next_improvement text not null default '',
  asset_ids uuid[] not null default '{}',
  visibility public.experience_visibility not null default 'private',
  moderation_status public.experience_moderation_status not null default 'draft',
  instructor_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  title text not null,
  summary text not null default '',
  skill_names text[] not null default '{}',
  score numeric(6,2),
  mastery_percent numeric(5,2) not null default 0,
  practice_percent numeric(5,2) not null default 0,
  confidence_percent numeric(5,2) not null default 0,
  instructor_comment text,
  evidence_asset_ids uuid[] not null default '{}',
  badge_code text,
  certificate_code text,
  issued_at timestamptz not null default now()
);

create table public.share_card_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  aspect_ratio text not null default '1:1' check (aspect_ratio in ('1:1','4:5','16:9')),
  brand_theme text not null default 'default',
  background_style text not null default 'gradient',
  show_logo boolean not null default true,
  show_verification_code boolean not null default true,
  default_caption text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.shared_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  result_id uuid not null references public.learning_results(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid references public.share_card_templates(id) on delete set null,
  channel public.share_channel not null default 'copy',
  public_slug text unique,
  caption text not null default '',
  generated_asset_id uuid references public.assets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  entry_type public.journal_entry_type not null default 'note',
  source_id uuid,
  title text not null default '',
  body text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Brain Assistant search index — keyword tier ships now; embedding is deferred.
-- TODO(learning-intelligence-v3): once the Supabase project has the `vector` extension
-- confirmed available, add an `embedding vector(1536)` column + ivfflat index here and switch
-- learning_match_knowledge_chunks() to similarity search. Until then this uses to_tsvector
-- keyword search, which is fully functional and does not require any extra provider.
-- ---------------------------------------------------------------------------

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  version_id uuid not null references public.knowledge_space_versions(id) on delete cascade,
  block_id uuid references public.learning_blocks(id) on delete cascade,
  chunk_label text not null default '',
  search_text text not null,
  search_vector tsvector generated always as (to_tsvector('simple', search_text)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index knowledge_chunks_search_idx on public.knowledge_chunks using gin(search_vector);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index knowledge_spaces_org_status_idx on public.knowledge_spaces(organization_id,status);
create index knowledge_space_versions_space_idx on public.knowledge_space_versions(knowledge_space_id,version_number desc);
create index learning_sections_version_idx on public.learning_sections(version_id,position);
create index learning_blocks_section_idx on public.learning_blocks(section_id,position);
create index knowledge_nodes_version_idx on public.knowledge_nodes(version_id);
create index knowledge_edges_version_idx on public.knowledge_edges(version_id);
create index completion_conditions_version_idx on public.completion_conditions(version_id);
create index experience_cases_org_idx on public.experience_cases(organization_id,moderation_status,visibility);
create index assignment_definitions_space_idx on public.assignment_definitions(knowledge_space_id);
create index block_progress_user_idx on public.block_progress(user_id,updated_at desc);
create index space_progress_user_idx on public.knowledge_space_progress(user_id,status);
create index learner_notes_space_idx on public.learner_notes(knowledge_space_id,user_id,created_at desc);
create index learner_experiences_space_idx on public.learner_experiences(knowledge_space_id,visibility,moderation_status);
create index learning_results_user_idx on public.learning_results(user_id,issued_at desc);
create index journal_entries_user_idx on public.journal_entries(user_id,knowledge_space_id,created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions: entitlement inherited from the existing academy lesson/course chain.
-- ---------------------------------------------------------------------------

create or replace function public.has_lesson_entitlement(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((
    select l.is_preview
      or public.has_org_role(c.organization_id,array['owner','admin','teacher']::public.member_role[])
      or exists(
        select 1 from public.entitlements e
        where e.user_id=auth.uid() and e.organization_id=c.organization_id and e.status='active'
          and (e.expires_at is null or e.expires_at>now())
          and ((e.resource_type='course' and e.resource_id=c.id) or e.resource_type='membership')
      )
    from public.academy_course_lessons l
    join public.academy_course_modules m on m.id=l.module_id
    join public.academy_courses c on c.id=m.course_id
    where l.id=p_lesson_id
  ), false);
$$;

create or replace function public.has_space_entitlement(p_space_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select public.has_lesson_entitlement(s.content_item_id) from public.knowledge_spaces s where s.id=p_space_id), false);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.knowledge_spaces enable row level security;
alter table public.knowledge_space_versions enable row level security;
alter table public.learning_sections enable row level security;
alter table public.learning_blocks enable row level security;
alter table public.knowledge_nodes enable row level security;
alter table public.knowledge_edges enable row level security;
alter table public.completion_conditions enable row level security;
alter table public.brain_templates enable row level security;
alter table public.experience_cases enable row level security;
alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.assignment_definitions enable row level security;
alter table public.brain_assignment_submissions enable row level security;
alter table public.block_progress enable row level security;
alter table public.knowledge_space_progress enable row level security;
alter table public.learner_notes enable row level security;
alter table public.learner_experiences enable row level security;
alter table public.learning_results enable row level security;
alter table public.share_card_templates enable row level security;
alter table public.shared_results enable row level security;
alter table public.journal_entries enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Knowledge Space metadata: staff always; learners once the underlying lesson is entitled or
-- previewable. Draft-only fields stay safe because block payload is a separate table below.
create policy "knowledge spaces read" on public.knowledge_spaces for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or public.has_lesson_entitlement(content_item_id));
create policy "knowledge spaces staff write" on public.knowledge_spaces for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "space versions read" on public.knowledge_space_versions for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or (status='published' and public.has_space_entitlement(knowledge_space_id)));
create policy "space versions staff write" on public.knowledge_space_versions for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "sections read" on public.learning_sections for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or exists(select 1 from public.knowledge_space_versions v where v.id=version_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id)));
create policy "sections staff write" on public.learning_sections for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

-- Learning blocks: the actual paid payload. Guests/entitled learners only ever see
-- visibility='preview' or ('all_entitled' + entitled); instructor/admin blocks stay staff-only.
create policy "blocks read" on public.learning_blocks for select
  using (
    public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])
    or (
      visibility='preview'
      and exists(select 1 from public.learning_sections s join public.knowledge_space_versions v on v.id=s.version_id where s.id=section_id and v.status='published')
    )
    or (
      visibility='all_entitled'
      and exists(select 1 from public.learning_sections s join public.knowledge_space_versions v on v.id=s.version_id where s.id=section_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id))
    )
  );
create policy "blocks staff write" on public.learning_blocks for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "nodes read" on public.knowledge_nodes for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or exists(select 1 from public.knowledge_space_versions v where v.id=version_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id)));
create policy "nodes staff write" on public.knowledge_nodes for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "edges read" on public.knowledge_edges for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or exists(select 1 from public.knowledge_space_versions v where v.id=version_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id)));
create policy "edges staff write" on public.knowledge_edges for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "conditions read" on public.completion_conditions for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or exists(select 1 from public.knowledge_space_versions v where v.id=version_id and v.status='published' and public.has_space_entitlement(v.knowledge_space_id)));
create policy "conditions staff write" on public.completion_conditions for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "templates visible" on public.brain_templates for select
  using (is_system or (organization_id is not null and public.is_org_member(organization_id)));
create policy "templates staff write" on public.brain_templates for all
  using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (organization_id is not null and public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "experience cases visible" on public.experience_cases for select
  using (
    public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])
    or author_id=auth.uid()
    or (moderation_status='approved' and visibility in ('class','community'))
  );
create policy "experience cases author write" on public.experience_cases for all
  using (author_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.is_org_member(organization_id) and (author_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[])));

create policy "rubrics staff" on public.rubrics for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "rubric criteria staff" on public.rubric_criteria for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "assignment defs read" on public.assignment_definitions for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or public.has_space_entitlement(knowledge_space_id));
create policy "assignment defs staff write" on public.assignment_definitions for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "submissions owner or grader read" on public.brain_assignment_submissions for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "submissions owner insert" on public.brain_assignment_submissions for insert
  with check (user_id=auth.uid() and public.is_org_member(organization_id));
create policy "submissions owner or grader update" on public.brain_assignment_submissions for update
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

create policy "block progress self" on public.block_progress for all
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "space progress self" on public.knowledge_space_progress for all
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "notes self" on public.learner_notes for all
  using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "learner experiences visible" on public.learner_experiences for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or (visibility in ('class','community') and moderation_status='approved'));
create policy "learner experiences self write" on public.learner_experiences for all
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "results self or staff" on public.learning_results for select
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));
create policy "results service write" on public.learning_results for insert
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or user_id=auth.uid());

create policy "share templates visible" on public.share_card_templates for select
  using (is_system or (organization_id is not null and public.is_org_member(organization_id)));
create policy "share templates staff write" on public.share_card_templates for all
  using (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (organization_id is not null and public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy "shared results self write" on public.shared_results for all
  using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "journal self" on public.journal_entries for all
  using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_org_member(organization_id));

create policy "knowledge chunks read" on public.knowledge_chunks for select
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]) or public.has_space_entitlement(knowledge_space_id));
create policy "knowledge chunks staff write" on public.knowledge_chunks for all
  using (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','teacher']::public.member_role[]));

-- Public share pages must never read block payload or private note content; only a narrow
-- SECURITY DEFINER RPC exposes shared_results, mirroring the certificate_issues pattern from
-- 0025_h2obook_operations_foundation.sql. No public SELECT policy is granted on learning_results
-- or shared_results themselves.
create or replace function public.get_public_shared_result(p_slug text)
returns table(title text, summary text, skill_names text[], mastery_percent numeric, practice_percent numeric, confidence_percent numeric, badge_code text, certificate_code text, caption text, issued_at timestamptz)
language sql stable security definer set search_path=public as $$
  select r.title, r.summary, r.skill_names, r.mastery_percent, r.practice_percent, r.confidence_percent, r.badge_code, r.certificate_code, sr.caption, r.issued_at
  from public.shared_results sr join public.learning_results r on r.id=sr.result_id
  where sr.public_slug=p_slug;
$$;
grant execute on function public.get_public_shared_result(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Publishing / versioning RPCs
-- ---------------------------------------------------------------------------

create or replace function public.learning_publish_space_version(p_version_id uuid, p_scheduled_at timestamptz default null)
returns public.knowledge_space_versions
language plpgsql security invoker set search_path=public as $$
declare
  v_version public.knowledge_space_versions;
  v_space public.knowledge_spaces;
begin
  select * into v_version from public.knowledge_space_versions where id=p_version_id for update;
  if v_version.id is null then raise exception 'VERSION_NOT_FOUND'; end if;
  select * into v_space from public.knowledge_spaces where id=v_version.knowledge_space_id for update;
  if not public.has_org_role(v_version.organization_id,array['owner','admin','teacher']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_version.status='published' then return v_version; end if;

  if p_scheduled_at is not null and p_scheduled_at>now() then
    update public.knowledge_space_versions set status='scheduled', scheduled_at=p_scheduled_at where id=p_version_id;
    select * into v_version from public.knowledge_space_versions where id=p_version_id;
    return v_version;
  end if;

  update public.knowledge_space_versions set status='superseded' where knowledge_space_id=v_space.id and status='published' and id<>p_version_id;
  update public.knowledge_space_versions set status='published', published_at=now() where id=p_version_id;
  update public.knowledge_spaces set active_version_id=p_version_id, status='published', updated_at=now() where id=v_space.id;

  insert into public.domain_events(organization_id,actor_id,resource_type,resource_id,event_name,payload)
  values(v_version.organization_id,auth.uid(),'knowledge_space_version',p_version_id,'learning.space_version.published',jsonb_build_object('knowledgeSpaceId',v_space.id,'versionNumber',v_version.version_number));

  select * into v_version from public.knowledge_space_versions where id=p_version_id;
  return v_version;
end;
$$;
grant execute on function public.learning_publish_space_version(uuid,timestamptz) to authenticated;

-- Service-role/cron only: publishes versions whose scheduled_at has arrived. Never call from the browser.
create or replace function public.learning_publish_due_space_versions(p_limit integer default 50)
returns setof public.knowledge_space_versions
language plpgsql security definer set search_path=public as $$
declare v_row record;
begin
  if auth.role() <> 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  for v_row in
    select id from public.knowledge_space_versions
    where status='scheduled' and scheduled_at<=now()
    order by scheduled_at limit greatest(1,least(p_limit,200))
    for update skip locked
  loop
    update public.knowledge_space_versions set status='superseded'
    where knowledge_space_id=(select knowledge_space_id from public.knowledge_space_versions where id=v_row.id)
      and status='published' and id<>v_row.id;
    update public.knowledge_space_versions set status='published', published_at=now() where id=v_row.id;
    update public.knowledge_spaces s set active_version_id=v_row.id, status='published', updated_at=now()
      from public.knowledge_space_versions v where v.id=v_row.id and s.id=v.knowledge_space_id;
  end loop;
  return query select * from public.knowledge_space_versions where status='published' and published_at>=now()-interval '1 minute';
end;
$$;
revoke all on function public.learning_publish_due_space_versions(integer) from public,anon,authenticated;
grant execute on function public.learning_publish_due_space_versions(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Brain Assistant fallback search (keyword tier — always available, no AI provider required)
-- ---------------------------------------------------------------------------

create or replace function public.learning_match_knowledge_chunks(p_space_id uuid, p_query text, p_limit integer default 6)
returns table(chunk_id uuid, block_id uuid, chunk_label text, search_text text, rank real)
language sql stable security invoker set search_path=public as $$
  select c.id, c.block_id, c.chunk_label, c.search_text, ts_rank(c.search_vector, websearch_to_tsquery('simple', p_query)) as rank
  from public.knowledge_chunks c
  where c.knowledge_space_id=p_space_id
    and public.has_space_entitlement(p_space_id)
    and c.search_vector @@ websearch_to_tsquery('simple', p_query)
  order by rank desc
  limit greatest(1,least(p_limit,20));
$$;
grant execute on function public.learning_match_knowledge_chunks(uuid,text,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at triggers + domain events + realtime, reusing 0007's shared infrastructure.
-- ---------------------------------------------------------------------------

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'knowledge_spaces','knowledge_space_versions','learning_sections','learning_blocks',
    'knowledge_nodes','brain_templates','experience_cases','rubrics','assignment_definitions',
    'brain_assignment_submissions','learner_notes','learner_experiences','journal_entries'
  ] loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'knowledge_spaces','knowledge_space_versions','brain_assignment_submissions','learning_results',
    'experience_cases'
  ] loop
    execute format('create trigger %I_domain_event after insert or update or delete on public.%I for each row execute function public.capture_domain_event()', table_name, table_name);
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

commit;


-- ===== 0027_h2obook_create_outcome_studio_v1.sql =====
-- H2OBOOK Create Outcome Studio V1 (adapter migration)
-- Source module: v5/10-h2obook-create-outcome-studio-upgrade-v1. Reference schema is
-- supabase/20260802_create_outcome_studio_upgrade.sql from that module; NOT applied as-is.
--
-- Audit finding: the existing public.books/book_pages/page_elements editor is staff-only —
-- save_book_document() (0005) requires has_org_role(...,array['owner','admin','designer',
-- 'partner','teacher']) and 'student' is not in that list. Reusing books for learner-owned
-- Outcome Projects would mean loosening that role check (widening every staff-book RLS policy
-- to students), a much bigger and riskier change than the module actually needs. Per the
-- module's own fallback rule ("Chỉ tạo create_outcome_projects nếu entity hiện tại không thể
-- mở rộng an toàn"), this migration creates one new, narrowly-scoped, owner-only table instead.
--
-- Scope of this pass: recipe catalog stays static application data (same convention already
-- used for the academy public catalog — see lib/public-site/content.ts), not a DB table, so no
-- create_outcome_recipes table is created here. create_outcome_checks/create_outcome_exports
-- from the reference schema are also not created; readiness/export state lives in
-- output_manifest jsonb for this pass (documented as a deferred normalization in the
-- integration report, not silently dropped).
begin;

create table public.create_outcome_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  outcome_type text not null check (outcome_type in (
    'portfolio','toolkit','casebook','brand_profile','content_plan','pricing_kit',
    'sales_playbook','workbook','certificate','custom'
  )),
  recipe_slug text not null,
  editor_mode text not null default 'guided' check (editor_mode in ('guided','standard','pro')),
  source_lesson_id uuid references public.academy_course_lessons(id) on delete set null,
  source_knowledge_space_id uuid references public.knowledge_spaces(id) on delete set null,
  source_stage_key text,
  template_ref text,
  status text not null default 'draft' check (status in (
    'draft','in_progress','needs_review','approved','ready_to_export','published','archived'
  )),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  content jsonb not null default '{}'::jsonb,
  output_manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index create_outcome_projects_owner_idx on public.create_outcome_projects(owner_user_id, updated_at desc);
create index create_outcome_projects_org_idx on public.create_outcome_projects(organization_id, status);

create table public.create_outcome_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.create_outcome_projects(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'link' check (channel in ('link','facebook','portfolio','instructor')),
  public_slug text unique,
  caption text not null default '',
  created_at timestamptz not null default now()
);
create index create_outcome_shares_project_idx on public.create_outcome_shares(project_id, created_at desc);

alter table public.create_outcome_projects enable row level security;
alter table public.create_outcome_shares enable row level security;

-- Learners: only their own projects. Staff: read-only across their organization (matches
-- "instructor chỉ xem project được nộp" intent without needing a separate class-assignment
-- table yet — full per-class scoping is listed as deferred in the integration report).
create policy "outcome projects owner all" on public.create_outcome_projects for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and public.is_org_member(organization_id));
create policy "outcome projects staff read" on public.create_outcome_projects for select
  using (public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));

create policy "outcome shares owner all" on public.create_outcome_shares for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid() and public.is_org_member(organization_id) and exists(
    select 1 from public.create_outcome_projects p where p.id = project_id and p.owner_user_id = auth.uid()
  ));

-- Public share pages must never read project content/manifest directly — only this narrow
-- SECURITY DEFINER RPC, mirroring get_public_shared_result() from 0026 and certificate_issues
-- from 0025. No public SELECT policy is granted on create_outcome_projects or
-- create_outcome_shares themselves.
create or replace function public.get_public_outcome_share(p_slug text)
returns table(title text, outcome_type text, caption text, readiness_score integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.title, p.outcome_type, s.caption, p.readiness_score, s.created_at
  from public.create_outcome_shares s
  join public.create_outcome_projects p on p.id = s.project_id
  where s.public_slug = p_slug;
$$;
grant execute on function public.get_public_outcome_share(text) to anon, authenticated;

create trigger create_outcome_projects_touch_updated_at before update on public.create_outcome_projects
for each row execute function public.touch_updated_at();

create trigger create_outcome_projects_domain_event after insert or update or delete on public.create_outcome_projects
for each row execute function public.capture_domain_event();
do $$ begin
  alter publication supabase_realtime add table public.create_outcome_projects;
exception when duplicate_object then null;
end $$;

commit;


-- ===== 0028_h2obook_learn_mastery_engine_v1.sql =====
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


-- ===== 0029_h2obook_teaching_intelligence_center_v1.sql =====
-- H2OBOOK Teaching Intelligence Center V1
-- Adapted from v5/12-h2obook-teaching-intelligence-center-v1. The reference migration proposed
-- 7 new tables (teach_role_assignments, teach_scope_assignments, teach_student_interventions,
-- teach_feedback_templates, teach_feedback_events, teach_content_review_assignments,
-- teach_rule_preferences) plus is_teach_admin()/can_teach_scope() helpers.
--
-- Audit result: this repo already has a real role system (public.member_role via
-- organization_members, checked with public.has_org_role()) and a real class-scope model
-- (public.classes.teacher_id / public.class_members) — see lib/auth/current-user.ts and
-- lib/auth/api.ts's resolveOrganizationAccess(). Introducing teach_role_assignments and
-- teach_scope_assignments would create a second, parallel identity/scope system that the app
-- would then have to keep in sync with organization_members and classes.teacher_id forever.
-- Instead: 'teacher' membership role + classes.teacher_id/class_members are the source of
-- truth for who teaches whom (see lib/teaching/access.ts).
--
-- Grading itself already has a real table (public.brain_assignment_submissions, 0026) and a
-- legacy one (public.assignment_submissions, 0002) — both already carry score/instructor_feedback
-- /status/graded_by/graded_at, so teach_feedback_events would just be a duplicate audit copy of
-- the same decision. The one piece those tables cannot express is a "portfolio-ready" decision
-- (distinct from a normal pass) on brain_assignment_submissions, so this migration adds a single
-- additive boolean column for that instead of introducing a parallel events table.
--
-- teach_feedback_templates, teach_content_review_assignments and teach_rule_preferences are
-- genuinely deferred for this pass (see docs/H2OBOOK-TEACHING-INTELLIGENCE-CENTER-V1-INTEGRATION-REPORT.md
-- §Risks/TODO) — Content & Approval reuses the existing /reviews + review_requests engine as-is,
-- and Automation rule toggles were out of scope for a first, real-data pass of the Teach surface.
--
-- The one genuinely new concept with no existing home is a private instructor note / action log
-- tied to a specific at-risk student ("Risk Radar" intervention) — that is real net-new data, so
-- it gets one new table: public.teach_student_interventions.

begin;

alter table public.brain_assignment_submissions
  add column if not exists portfolio_ready boolean not null default false;

create table public.teach_student_interventions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_user_id uuid not null references public.profiles(id) on delete cascade,
  teacher_user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  risk_level text not null check (risk_level in ('watch','attention','critical')),
  reason_codes text[] not null default '{}',
  action_type text not null check (action_type in ('message','assignment','meeting','resource','stage_review','other')),
  note text,
  status text not null default 'open' check (status in ('open','scheduled','completed','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teach_student_interventions_student_idx on public.teach_student_interventions(organization_id, student_user_id, status);
create index teach_student_interventions_teacher_idx on public.teach_student_interventions(organization_id, teacher_user_id, status);

alter table public.teach_student_interventions enable row level security;

-- Read: the owning teacher, the student themself, or org owner/admin.
create policy "interventions read own org scope"
on public.teach_student_interventions for select
to authenticated
using (
  teacher_user_id = auth.uid()
  or student_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
);

-- Insert: only a real 'teacher' (or owner/admin) of the organization, and only as themself.
create policy "interventions teacher insert"
on public.teach_student_interventions for insert
to authenticated
with check (
  teacher_user_id = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[])
);

create policy "interventions teacher update"
on public.teach_student_interventions for update
to authenticated
using (
  teacher_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
)
with check (
  teacher_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
);

create trigger teach_student_interventions_domain_event after insert or update or delete on public.teach_student_interventions
for each row execute function public.capture_domain_event();
do $$ begin
  alter publication supabase_realtime add table public.teach_student_interventions;
exception when duplicate_object then null;
end $$;

-- 0027 only ever gave staff a broad, unscoped SELECT on create_outcome_projects ("outcome
-- projects staff read") and explicitly deferred real per-class scoping. This adds the missing
-- UPDATE path (needed for Feedback Studio's portfolio review action) scoped to the project
-- owner's actual class teacher — not just "any teacher in the org" — so an instructor can only
-- move a portfolio project to approved/in_progress for a student in one of their own classes.
create policy "outcome projects teacher review update"
on public.create_outcome_projects for update
to authenticated
using (
  owner_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  or exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.user_id = create_outcome_projects.owner_user_id
      and cm.status = 'active'
      and c.teacher_id = auth.uid()
  )
)
with check (
  owner_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  or exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.user_id = create_outcome_projects.owner_user_id
      and cm.status = 'active'
      and c.teacher_id = auth.uid()
  )
);

commit;


-- ===== 0030_h2obook_business_growth_commerce_v1.sql =====
-- H2OBOOK Business Growth & Commerce Engine V1
-- Adapted from v5/13-h2obook-business-growth-commerce-engine-v1. The reference migration
-- proposed 5 new tables (h2o_business_goals, h2o_business_opportunities, h2o_business_tasks,
-- h2o_business_feature_grants, h2o_business_provenance_events) plus a has_business_feature()
-- helper.
--
-- Audit result: this repo already has real, live commerce tables — public.products/orders/
-- order_items (0002) and public.memberships/entitlements (0001/0002, hardened by
-- public.mark_order_paid() in 0005) — already wired to the real payment webhook
-- (app/api/payments/webhook/[provider]/route.ts). Nothing here duplicates those. The prompt's
-- Admin Business Operations routes (/store, /orders, /membership, /analytics,
-- /marketplace-studio, /licensing, /white-label, /growth-reader) are explicitly untouched by
-- this migration and this module's code.
--
-- h2o_business_tasks was NOT ported: the reference module's own buildBusinessTasks() is a pure
-- function of already-real metrics (lead count, published content count, booking count) — same
-- "derive, don't persist" pattern already used for the Today Task Planner (0028's header
-- comment) and the Teaching Command Center (0029). See lib/business/command-center.ts.
--
-- h2o_business_provenance_events was NOT ported as a separate table: the only real target this
-- pass has is business_opportunities (no Offer/Campaign entity exists yet — see the integration
-- report's Risks/TODO), so provenance is two inline columns on business_opportunities instead of
-- a whole extra table.
--
-- business_feature_grants IS a new table: the generic public.entitlements table requires a uuid
-- resource_id (it grants access to real content resources like books/templates), which does not
-- fit a fixed text feature-slug vocabulary (e.g. "lead_tracker", "pricing_builder"). Renamed from
-- the reference module's h2o_business_feature_grants (dropped the h2o_ prefix — no other table in
-- this repo uses it) and organization_id instead of workspace_id, matching this repo's convention.

begin;

create table public.business_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  unit text not null check (unit in ('lead','booking','revenue','content','repeat_customer')),
  target_value numeric not null check (target_value >= 0),
  current_value numeric not null default 0 check (current_value >= 0),
  due_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_goals_owner_idx on public.business_goals(owner_id, organization_id, status);

create table public.business_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text not null,
  customer_contact jsonb not null default '{}'::jsonb,
  service_name text not null,
  estimated_value numeric not null default 0 check (estimated_value >= 0),
  status text not null default 'new' check (status in ('new','contacted','consulting','proposal','booked','won','lost')),
  source text,
  next_action_at timestamptz,
  notes text,
  -- Learn -> Create -> Business provenance (CLAUDE_INTEGRATION_PROMPT.md §7): which lesson/skill
  -- or Create Outcome project this opportunity/offer grew out of, if any. No paid content is
  -- copied here — only reference IDs and the minimal snapshot needed to show provenance in the UI.
  source_domain text not null default 'manual' check (source_domain in ('learn','create','teach','manual')),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_opportunities_owner_idx on public.business_opportunities(owner_id, organization_id, status);

create table public.business_feature_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_slug text not null,
  source_type text not null check (source_type in ('membership','purchase','stage','manual_grant')),
  source_id uuid,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, feature_slug, source_type, source_id)
);
create index business_feature_grants_user_idx on public.business_feature_grants(user_id, organization_id, feature_slug);

alter table public.business_goals enable row level security;
alter table public.business_opportunities enable row level security;
alter table public.business_feature_grants enable row level security;

-- Learners own their personal goals/pipeline outright. Staff read access reuses the same
-- has_org_role() helper as every other table in this repo (0001) instead of a new admin check.
create policy "business goals owner all"
on public.business_goals for all
to authenticated
using (owner_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (owner_id = auth.uid() and public.is_org_member(organization_id));

create policy "business opportunities owner all"
on public.business_opportunities for all
to authenticated
using (owner_id = auth.uid() or public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (owner_id = auth.uid() and public.is_org_member(organization_id));

-- Feature grants: a learner can only ever read their own active grants. Only Admin/Owner (or
-- trusted server code using the service-role key, e.g. a future payment webhook extension) may
-- insert/update/delete — "user không tự cấp feature" (CLAUDE_INTEGRATION_PROMPT.md §13).
create policy "business feature grants self read"
on public.business_feature_grants for select
to authenticated
using (
  (user_id = auth.uid() and revoked_at is null and (expires_at is null or expires_at > now()))
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
);

create policy "business feature grants admin write"
on public.business_feature_grants for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "business feature grants admin update"
on public.business_feature_grants for update
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "business feature grants admin delete"
on public.business_feature_grants for delete
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create trigger business_goals_touch_updated_at before update on public.business_goals
for each row execute function public.touch_updated_at();
create trigger business_opportunities_touch_updated_at before update on public.business_opportunities
for each row execute function public.touch_updated_at();

-- Full change history (CLAUDE_INTEGRATION_PROMPT.md §9 "notes/history") comes for free from the
-- existing domain-event audit trail (0007) instead of a bespoke opportunity-history table.
create trigger business_goals_domain_event after insert or update or delete on public.business_goals
for each row execute function public.capture_domain_event();
create trigger business_opportunities_domain_event after insert or update or delete on public.business_opportunities
for each row execute function public.capture_domain_event();

commit;


-- ===== 0031_h2obook_academy_control_center_v1.sql =====
-- H2OBOOK Academy Control Center V1
-- Adapted from v5/15-h2obook-academy-control-center-v1. The reference module proposes a full
-- parallel content model (ContentAsset, Lesson, Course, CourseModule, Roadmap, EntitlementGrant,
-- Enrollment, QualityIssue — its own types.ts). This repo already has real, live tables that
-- model almost all of it: public.academy_courses/academy_course_modules/academy_course_lessons
-- (0024, with a full draft/published/archived status workflow, video fields, skill_keys,
-- content jsonb) and public.entitlements (0001, resource_type/resource_id/source_type/status).
-- No parallel Course/Lesson/Entitlement tables were created — the Course Builder and Distribution
-- Center this pass ships read/write those tables directly (see lib/academy-admin/*).
--
-- The one real gap: public.entitlements has no admin-facing INSERT/UPDATE RLS policy at all
-- (its only existing policy, "entitlements self read" from 0001, is SELECT-only — every write
-- today happens through mark_order_paid(), a security-definer function that bypasses RLS
-- entirely) and no reason/granted_by columns, both required by the module's own Phase 8 ("Manual
-- grant must require: User, Resource, Start date, Expiry, Reason, Granting actor, Audit event").
-- This migration adds exactly those two additive columns, the missing admin write policies, and
-- an audit trigger reusing the existing capture_domain_event() function (0007) rather than a new
-- audit table.

begin;

alter table public.entitlements add column if not exists reason text;
alter table public.entitlements add column if not exists granted_by uuid references public.profiles(id) on delete set null;

create policy "entitlements admin manual grant insert"
on public.entitlements for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create policy "entitlements admin update"
on public.entitlements for update
to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

create trigger entitlements_domain_event after insert or update or delete on public.entitlements
for each row execute function public.capture_domain_event();

commit;


-- ===== 0032_h2obook_safe_signup_default.sql =====
-- H2OBOOK — Safe signup default for handle_new_user()
--
-- Root cause of the live incident this migration fixes: handle_new_user() (0024) auto-creates a
-- brand-new organization and makes the signer its Owner whenever
-- coalesce(new.raw_user_meta_data->>'role','owner') = 'owner' — which is true both when role is
-- explicitly "owner" AND whenever role is absent entirely. The public /signup page's own bug
-- (fixed separately, application-layer, in feature/student-self-signup-stage-lock) always sent
-- role:"owner" explicitly, which is what actually fired in production — but the *coalesce
-- default* was never safe on its own: any future signup path that does not explicitly set
-- raw_user_meta_data.role (a magic link, an admin-invited user whose invite call forgot the
-- field, and — the immediate reason this is being fixed now — Google/OAuth sign-in, which does
-- not let the client control raw_user_meta_data the way supabase.auth.signUp() does) would hit
-- the exact same bug: a brand-new Owner workspace, silently, for anyone who signs up.
--
-- Fix: require role to be the literal string 'owner' — no default. Any other value, or no role
-- at all (the case for every OAuth/Google sign-in and every other future signup path), now
-- creates no organization at all. lib/auth/current-user.ts's getCurrentUser() already treats a
-- session with no organization_members row as role "student" (a pre-existing, already-safe
-- fallback — unchanged), and app/auth/callback/route.ts now completes a real academy-student
-- join for exactly that case (see the accompanying application-layer change). No table changed,
-- no data touched — this only replaces the function body.

begin;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid;
  v_name text;
  v_slug text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '');
  insert into public.profiles(id,email,full_name,avatar_url)
  values(new.id,lower(new.email),coalesce(v_name,''),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,avatar_url=excluded.avatar_url,updated_at=now();
  if new.raw_user_meta_data->>'role'='owner' and not exists(select 1 from public.organization_members where user_id=new.id) then
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(v_name,split_part(new.email,'@',1),'h2obook')), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(new.id::text,'-',''),1,8);
    insert into public.organizations(name,slug,owner_id) values(coalesce(v_name,'H2OBOOK Workspace'),v_slug,new.id) returning id into v_org_id;
    insert into public.organization_members(organization_id,user_id,role,status) values(v_org_id,new.id,'owner','active');
  end if;
  return new;
end;
$$;

commit;

-- Rollback: re-run 0024's original create-or-replace of public.handle_new_user() (restores the
-- coalesce(...,'owner') default). Not recommended — that is the exact behavior that caused the
-- live incident.


-- ===== 0033_h2obook_career_stage_curriculum.sql =====
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


-- ===== 0034_h2obook_content_access_engine_v1.sql =====
-- H2OBOOK Content Access Engine V1
--
-- Adapted from v5/18-h2obook-content-access-engine-v1. The source module proposes twelve new
-- ca_* tables. All twelve were rejected as duplicates of tables this repo already has — see
-- docs/H2OBOOK-CONTENT-ACCESS-ENGINE-V1-INTEGRATION-REPORT.md §2 for the full mapping. In short:
-- ca_learning_paths/ca_path_stages/ca_stage_resource_bindings are career_stages and
-- career_stage_resources (0033); ca_access_grants is entitlements (0001);
-- ca_student_package_subscriptions is memberships (0001); ca_access_packages is products;
-- ca_access_audit_logs is domain_events (0007, and module 17 already retired the separate audit
-- table); ca_resources mirrors books/academy_courses/publications; ca_resource_progress mirrors
-- academy_lesson_progress. The module's own README asks for exactly this audit first.
--
-- Its ca_is_org_admin() also had to go on its own merits, independent of duplication: it reads the
-- role from auth.jwt() -> 'user_metadata' ->> 'role'. user_metadata is user-writable, so anyone
-- who sets role:"admin" on themselves would have passed it. It also treats a token with no
-- organization claim as valid for every organization, and falls back to a workspace_members table
-- that does not exist here. This repo resolves roles from organization_members via
-- has_org_role(), which is what the policies below keep using.
--
-- What is adopted is the part that is genuinely missing here: richer unlock rules. Six additive
-- columns on the existing binding table, no new tables, no data touched. The accompanying pure
-- resolver (lib/content-access/resolver.ts) is where the precedence logic lives.

begin;

alter table public.career_stage_resources
  add column if not exists unlock_mode text not null default 'immediate'
    check (unlock_mode in ('immediate','stage_active','after_resource','progress_gte','date','manual')),
  -- References another row in this same table rather than a resource id, so a prerequisite is
  -- always something actually placed in the curriculum, not a dangling polymorphic pointer.
  add column if not exists prerequisite_binding_id uuid references public.career_stage_resources(id) on delete set null,
  add column if not exists required_progress numeric(5,2) check (required_progress >= 0 and required_progress <= 100),
  add column if not exists unlock_at timestamptz,
  add column if not exists requirement_type text not null default 'required'
    check (requirement_type in ('required','optional','bonus')),
  add column if not exists display_locations text[] not null default array['library','journey'];

-- 'immediate' keeps every row created before this migration behaving exactly as it did: available
-- as soon as its stage is unlocked, which is what the access column alone used to mean.
comment on column public.career_stage_resources.unlock_mode is
  'When the resource opens once its stage is reachable. Composes with access: access decides whether the stage matters at all (free_preview bypasses it), unlock_mode refines when inside the stage.';

create index if not exists career_stage_resources_prerequisite_idx
  on public.career_stage_resources(prerequisite_binding_id)
  where prerequisite_binding_id is not null;

commit;

-- Rollback:
--   alter table public.career_stage_resources
--     drop column if exists unlock_mode,
--     drop column if exists prerequisite_binding_id,
--     drop column if exists required_progress,
--     drop column if exists unlock_at,
--     drop column if exists requirement_type,
--     drop column if exists display_locations;
-- Purely additive with defaults that reproduce the previous behaviour, so dropping them restores
-- the prior state exactly and no existing row changes meaning in the meantime.


-- ===== 0035_h2obook_analytics_event_id_conflict_target.sql =====
-- H2OBOOK — make analytics_events.event_id a usable ON CONFLICT target
--
-- Every analytics POST from the browser was answering 400 with
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- so the client queue never drained and retried the same batch on every page.
--
-- Cause: migration 0015 created the uniqueness as a PARTIAL index —
--   create unique index analytics_event_id_unique on analytics_events(event_id) where event_id is not null;
-- PostgreSQL will only infer a partial index as an ON CONFLICT target when the statement repeats
-- the same predicate, and PostgREST's on_conflict never sends one. So the index existed, enforced
-- uniqueness correctly, and was invisible to the upsert.
--
-- The predicate was pointless anyway: app/api/analytics/events always sends event_id, and a plain
-- unique index still permits many NULL rows because Postgres treats NULLs as distinct by default.
-- Dropping the predicate therefore changes nothing about what is allowed and makes the upsert work.
--
-- Safe on existing data: the partial index already enforced uniqueness over every non-null value,
-- so no duplicate can be present for the new index to trip on.

begin;

drop index if exists public.analytics_event_id_unique;
create unique index if not exists analytics_event_id_unique on public.analytics_events(event_id);

commit;

-- Rollback:
--   drop index if exists public.analytics_event_id_unique;
--   create unique index analytics_event_id_unique on public.analytics_events(event_id) where event_id is not null;
-- Restores 0015 exactly — and with it the 400 on every analytics batch.


-- ===== 0036_h2obook_assignment_criterion_feedback.sql =====
-- H2OBOOK — persist per-criterion grading so the student can see it
--
-- Audit before adding anything. The assignment transaction the audit asks for is almost entirely
-- built already, on the 0026 "Brain" tables rather than the older class-based pair from 0002:
--   * assignment_definitions — instructions, submission_types, max/passing score, rubric_id, and
--     allow_resubmission, so per-assignment rubrics and resubmission are modelled.
--   * brain_assignment_submissions — status on the submission_status enum
--     (draft / submitted / in_review / revision_requested / graded), score, instructor_feedback,
--     graded_by, graded_at, and portfolio_ready from 0029. No unique constraint on
--     (assignment_id, user_id), so multiple attempts are already allowed: the history the audit
--     wants is a query, not a schema change.
--   * rubrics + rubric_criteria — per-criterion titles and max scores.
-- No new table is needed for any of that, and none is created here.
--
-- The one real gap: lib/teaching/grading.ts collects criteria: RubricCriterionScore[] from the
-- instructor, feeds them to evaluateFeedbackReadiness(), then stores only the resulting percentage
-- and one block of written feedback. The per-criterion detail — the part that tells a learner
-- which specific thing to fix — is computed and thrown away. Feedback that says "72%" teaches
-- nothing; feedback that says which criterion failed teaches the next attempt.
--
-- Stored as jsonb on the submission rather than as a child table: these scores are only ever read
-- back with their own submission, never queried across submissions, and a table would add a join
-- and a second RLS surface for no gain.

begin;

alter table public.brain_assignment_submissions
  add column if not exists criterion_scores jsonb not null default '[]'::jsonb;

comment on column public.brain_assignment_submissions.criterion_scores is
  'Per-criterion grading captured at grade time: [{criterionId, score, maxScore, required}]. Written by lib/teaching/grading.ts, read by the student submission view. Empty array means the submission has not been graded, or was graded before this column existed.';

commit;

-- Rollback:
--   alter table public.brain_assignment_submissions drop column if exists criterion_scores;
-- Additive with a default, so existing rows read as "no per-criterion detail" and nothing that
-- worked before this migration behaves differently after it.


-- ===== 0037_h2obook_asset_governance_v1.sql =====
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

-- Re-runnable. Postgres has no `create policy if not exists`, so every policy and trigger below
-- drops first — otherwise a second run fails with 42710 on the first policy and rolls the whole
-- transaction back, which makes it impossible to tell a partly-applied migration from a fully
-- applied one by running it again.
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

drop policy if exists "asset folders member read" on public.asset_folders;
create policy "asset folders member read" on public.asset_folders for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists "asset folders admin write" on public.asset_folders;
create policy "asset folders admin write" on public.asset_folders for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]));

drop policy if exists "asset tags member read" on public.asset_tags;
create policy "asset tags member read" on public.asset_tags for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists "asset tags admin write" on public.asset_tags;
create policy "asset tags admin write" on public.asset_tags for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]));

drop policy if exists "asset tag links member read" on public.asset_tag_links;
create policy "asset tag links member read" on public.asset_tag_links for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists "asset tag links admin write" on public.asset_tag_links;
create policy "asset tag links admin write" on public.asset_tag_links for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','designer']::public.member_role[]));

-- A private saved view belongs to whoever made it; a shared one is visible to the workspace.
drop policy if exists "asset saved views read" on public.asset_saved_views;
create policy "asset saved views read" on public.asset_saved_views for select to authenticated
using (public.is_org_member(organization_id) and (is_shared or created_by = auth.uid()));
drop policy if exists "asset saved views write" on public.asset_saved_views;
create policy "asset saved views write" on public.asset_saved_views for all to authenticated
using (public.is_org_member(organization_id) and created_by = auth.uid())
with check (public.is_org_member(organization_id) and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Audit. Replaces the proposed asset_audit_logs table with the mechanism already in use.
-- ---------------------------------------------------------------------------
drop trigger if exists assets_domain_event on public.assets;
create trigger assets_domain_event after insert or update or delete on public.assets
for each row execute function public.capture_domain_event();

drop trigger if exists asset_folders_domain_event on public.asset_folders;
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


-- ===== 0038_h2obook_asset_organization.sql =====
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


-- ===== 0039_h2obook_asset_stage_link.sql =====
-- H2OBOOK — let an asset be attached to a career stage
--
-- This is the schema decision module 0038 deliberately left open, now taken.
--
-- Module 19 proposed a dedicated asset_stage_links table. That was rejected in
-- docs/asset-governance-integration-audit.md §4 because career_stage_resources (0033) already maps
-- a stage to a thing by resource_type + resource_id, and the content access resolver (0034) reads
-- it — a second mapping would re-fragment exactly what 0033/0034 unified. The audit said the right
-- move, if raw assets ever needed attaching to a stage, was to widen that column rather than build
-- a parallel path. This does that.
--
-- Consequence worth stating plainly, because it is the reason the decision was deferred rather than
-- taken casually: an asset attached this way is a curriculum resource, so the access engine governs
-- it like any other. That is deliberate. The alternative — a link that means "intended for stage 3"
-- but grants nothing — is a note, and notes belong in the asset's own metadata, not in the table
-- the access engine trusts. If a purely advisory link is wanted later, assets.metadata is where it
-- goes, not here.
--
-- Attaching is already possible with no new UI: Academy Admin -> Giai đoạn & tài liệu has a resource
-- picker driven by the same list this constraint holds.

begin;

alter table public.career_stage_resources drop constraint if exists career_stage_resources_resource_type_check;

alter table public.career_stage_resources
  add constraint career_stage_resources_resource_type_check
  check (resource_type in ('book','course','publication','template','knowledge_space','roadmap','link','asset'));

commit;

-- Rollback:
--   Any rows with resource_type = 'asset' must be removed or re-typed first, or the narrower
--   constraint cannot be re-applied:
--     delete from public.career_stage_resources where resource_type = 'asset';
--   then:
--     alter table public.career_stage_resources drop constraint if exists career_stage_resources_resource_type_check;
--     alter table public.career_stage_resources
--       add constraint career_stage_resources_resource_type_check
--       check (resource_type in ('book','course','publication','template','knowledge_space','roadmap','link'));

-- ===== 0040_h2obook_career_stage_programs.sql =====
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

-- ===== 0041_h2obook_academy_control_center_v2.sql =====
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

-- ===== 0042_h2obook_stage_workspace_v3.sql =====
-- H2OBOOK Stage Workspace V3 — publish timestamps only
--
-- Adapted from v5/23-h2obook-stage-workspace-v3. The source module is a UI/UX design (3-pane
-- Structure Explorer / Content Canvas / Inspector, Stage Health, Preflight, Resource Picker) backed
-- entirely by a mock repository — no real schema decisions were made in it beyond a wishlist of
-- columns. Nearly every proposed column on career_stage_resources already exists under a different
-- name from migrations 0033/0034/0036/0041:
--
--   resource_role      -> requirement_type   (required/optional/bonus — already a check constraint)
--   access_mode         -> access             (free_preview/stage_locked/entitlement_only)
--   unlock_resource_id  -> prerequisite_binding_id
--   sort_order          -> position
--   featured            -> is_featured        (migration 0041)
--   visible             -> status <> 'hidden'
--   node_id, surface     -> already added in migration 0041, no-ops here
--
-- Adding a second column for each of these is the exact duplication pattern flagged in every audit
-- this session (media_assets vs assets, unlock_rule vs unlock_mode, student_label vs title_override,
-- ...). None of it is added. The one genuine gap — a stage cannot record when it was published or
-- archived, which the new Preflight/Publish workflow needs — is filled here. Health scoring and
-- preflight checks are computed from existing data at read time (lib/academy-control/health.ts),
-- not stored.

begin;

alter table public.career_stages add column if not exists published_at timestamptz;
alter table public.career_stages add column if not exists archived_at timestamptz;

commit;

-- Rollback:
--   alter table public.career_stages drop column if exists archived_at;
--   alter table public.career_stages drop column if exists published_at;

-- ===== 0043_h2obook_stage_node_surface.sql =====
-- H2OBOOK — a program/module/group can declare which student surface it belongs to
--
-- Migration 0041 put `surface` (learn/create/business/coaching) on career_stage_resources only.
-- In practice a whole program belongs to one surface — "Marketing nền tảng" is Business, all
-- twenty of its resources included — so setting it per resource meant repeating the same answer
-- twenty times, and the structure tree could not show which surface a branch belonged to because
-- the branch itself had no opinion.
--
-- surface here is nullable and advisory: a resource with its own surface keeps it, a resource
-- without one inherits from the nearest ancestor node that has one (resolved in
-- lib/academy-control/service.ts, not in SQL — the inheritance walk is three levels at most and
-- belongs where the tree is already being assembled). Nothing is backfilled: every existing row
-- keeps exactly the behaviour it had before this column existed.

begin;

alter table public.academy_stage_nodes add column if not exists surface text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'academy_stage_nodes_surface_check') then
    alter table public.academy_stage_nodes add constraint academy_stage_nodes_surface_check
      check (surface is null or surface in ('learn','create','business','coaching'));
  end if;
end $$;

commit;

-- Rollback:
--   alter table public.academy_stage_nodes drop constraint if exists academy_stage_nodes_surface_check;
--   alter table public.academy_stage_nodes drop column if exists surface;

-- ===== 0044_h2obook_brain_curator_v1.sql =====
-- H2OBOOK — H2O Brain Curator V1: a review queue between the asset library and the curriculum
--
-- Adapted from v5/24-H2OBOOK_H2O_BRAIN_CURATOR_V1 after the audit in
-- docs/module-24-brain-curator-audit.md, where the user chose the narrowest of four options:
-- build the queue and the deterministic rule engine now, leave AI as a pluggable source later.
--
-- Two of the source module's six tables are deliberately NOT created:
--
--   brain_provider_settings — it stores third-party API keys AES-GCM-encrypted in Postgres. Every
--     other third-party credential in this repo lives in an environment variable and none live in
--     the database (lib/email/provider.ts, lib/payments/provider.ts), and the module's own
--     alternative `env_ref` mode matches that. With no AI provider implemented yet, the table would
--     have no reader at all; when AI does land it needs its own usage/cost columns anyway.
--
--   brain_runs — it records one row per AI call, with usage/error columns. Rule evaluation is
--     synchronous and deterministic: it cannot half-fail, and the suggestion row already carries
--     which rules matched and when. A table whose only writer always writes "succeeded" is not an
--     audit trail; capture_domain_event already provides that one.
--
-- What remains is the part that works today without any AI, any API key, or any per-call cost:
-- queue an asset, get a suggested placement from rules the owner wrote and from what the admin
-- approved before, review it, approve it into career_stage_resources.

begin;

-- 1. The queue ------------------------------------------------------------------------------------
-- One row per asset waiting to be filed into the curriculum. source_asset_id is a real FK to
-- public.assets — the asset itself is never copied, and deleting it releases the queue row rather
-- than leaving it pointing at nothing.

create table if not exists public.brain_inbox_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_asset_id uuid references public.assets(id) on delete cascade,
  title text not null,
  status text not null default 'review' check (status in ('review','approved','rejected','archived')),
  admin_context jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An asset already waiting in the queue must not be queued a second time.
  unique (organization_id, source_asset_id)
);

create index if not exists brain_inbox_items_org_status_idx on public.brain_inbox_items (organization_id, status, created_at desc);

-- 2. Deterministic classification rules -------------------------------------------------------------
-- conditions/actions are jsonb because the shape is authored in the admin UI, but they are not
-- free-form: lib/brain/rules.ts defines and validates the exact shape, and anything it does not
-- recognise is ignored rather than guessed at.

create table if not exists public.brain_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brain_rules_org_priority_idx on public.brain_rules (organization_id, enabled, priority);

-- 3. Suggestions ------------------------------------------------------------------------------------
-- `source` is the point of the whole design: a suggestion is independent of what produced it. Today
-- that is 'rule' or 'memory'; 'ai' is listed so adding a provider later needs no migration, and
-- 'manual' covers an admin filing something with no suggestion at all.

create table if not exists public.brain_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inbox_item_id uuid not null references public.brain_inbox_items(id) on delete cascade,
  source text not null default 'rule' check (source in ('rule','memory','manual','ai')),
  suggested_stage_id uuid references public.career_stages(id) on delete set null,
  suggested_node_id uuid references public.academy_stage_nodes(id) on delete set null,
  surface text check (surface is null or surface in ('learn','create','business','coaching')),
  confidence numeric(5,4) not null default 0 check (confidence >= 0 and confidence <= 1),
  reason text not null default '',
  decision text not null default 'pending' check (decision in ('pending','approved','edited','rejected')),
  reviewer_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  applied_resource_id uuid references public.career_stage_resources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brain_suggestions_review_idx on public.brain_suggestions (organization_id, decision, confidence desc, created_at desc);
create index if not exists brain_suggestions_item_idx on public.brain_suggestions (inbox_item_id);

-- 4. What the admin has decided before ---------------------------------------------------------------
-- The substitute for AI in this release. Approving "every video in folder X goes to Stage 2 / Learn"
-- three times makes that the suggestion the fourth time — the admin's own decisions become the
-- classifier, with no model, no API key and no per-call cost. signal_key is computed in
-- lib/brain/rules.ts (e.g. `subtype:video`, `mime:application/pdf`, `folder:<uuid>`).

create table if not exists public.brain_memory_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  signal_key text not null,
  stage_id uuid references public.career_stages(id) on delete cascade,
  node_id uuid references public.academy_stage_nodes(id) on delete set null,
  surface text check (surface is null or surface in ('learn','create','business','coaching')),
  evidence_count integer not null default 1 check (evidence_count > 0),
  last_confirmed_by uuid references public.profiles(id) on delete set null,
  last_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- One row per (signal, destination): approving the same pairing again raises its evidence count
  -- rather than adding a duplicate, which is what makes "most confirmed wins" meaningful.
  unique (organization_id, signal_key, stage_id, node_id, surface)
);

create index if not exists brain_memory_signals_lookup_idx on public.brain_memory_signals (organization_id, signal_key, evidence_count desc);

-- 5. RLS ---------------------------------------------------------------------------------------------
-- Admin and owner both curate. Rules are owner-only to write: a rule silently redirects where every
-- future document lands, which is a different level of authority from filing one document.

alter table public.brain_inbox_items enable row level security;
alter table public.brain_rules enable row level security;
alter table public.brain_suggestions enable row level security;
alter table public.brain_memory_signals enable row level security;

drop policy if exists "brain inbox admin all" on public.brain_inbox_items;
create policy "brain inbox admin all" on public.brain_inbox_items for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists "brain rules admin read" on public.brain_rules;
create policy "brain rules admin read" on public.brain_rules for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists "brain rules owner write" on public.brain_rules;
create policy "brain rules owner write" on public.brain_rules for all to authenticated
using (public.has_org_role(organization_id, array['owner']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner']::public.member_role[]));

drop policy if exists "brain suggestions admin all" on public.brain_suggestions;
create policy "brain suggestions admin all" on public.brain_suggestions for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists "brain memory admin all" on public.brain_memory_signals;
create policy "brain memory admin all" on public.brain_memory_signals for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop trigger if exists brain_inbox_items_domain_event on public.brain_inbox_items;
create trigger brain_inbox_items_domain_event after insert or update or delete on public.brain_inbox_items
for each row execute function public.capture_domain_event();

drop trigger if exists brain_suggestions_domain_event on public.brain_suggestions;
create trigger brain_suggestions_domain_event after insert or update or delete on public.brain_suggestions
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   drop trigger if exists brain_suggestions_domain_event on public.brain_suggestions;
--   drop trigger if exists brain_inbox_items_domain_event on public.brain_inbox_items;
--   drop table if exists public.brain_memory_signals;
--   drop table if exists public.brain_suggestions;
--   drop table if exists public.brain_rules;
--   drop table if exists public.brain_inbox_items;
-- Nothing outside these four tables is touched: assets, career_stages, academy_stage_nodes and
-- career_stage_resources are only ever read or written through their existing paths.
