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
