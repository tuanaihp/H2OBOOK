-- Academy-wide non-teaching days. These are deliberately organization scoped so a holiday
-- entered once is respected by every current and future class when its schedule is generated.
begin;

create table public.academy_calendar_blackouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  blackout_date date not null,
  label text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, blackout_date)
);

create index academy_calendar_blackouts_org_date_idx
  on public.academy_calendar_blackouts(organization_id, blackout_date);

alter table public.academy_calendar_blackouts enable row level security;
create policy "academy calendar blackouts read" on public.academy_calendar_blackouts for select
  using (public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));
create policy "academy calendar blackouts admin write" on public.academy_calendar_blackouts for all
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

commit;
