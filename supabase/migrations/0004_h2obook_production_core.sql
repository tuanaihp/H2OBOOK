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
