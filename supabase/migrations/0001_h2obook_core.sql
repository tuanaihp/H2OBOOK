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
