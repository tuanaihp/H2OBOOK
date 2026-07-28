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
