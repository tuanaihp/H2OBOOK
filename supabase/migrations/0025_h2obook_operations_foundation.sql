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
