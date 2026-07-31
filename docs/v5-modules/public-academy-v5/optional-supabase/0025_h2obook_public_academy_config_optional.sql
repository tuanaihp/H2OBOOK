-- OPTIONAL DRAFT ONLY.
-- Do not run on production before Claude Code compares the real organization/RLS helpers.

create table if not exists public.public_academy_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  slug text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, slug)
);

create index if not exists public_academy_configs_status_idx
  on public.public_academy_configs (status, slug);

alter table public.public_academy_configs enable row level security;

-- Replace these example policies with the repository's actual workspace membership helpers.
-- Public read should be limited to the published row used by the public site.
create policy "public can read published academy config"
  on public.public_academy_configs
  for select
  using (status = 'published');
