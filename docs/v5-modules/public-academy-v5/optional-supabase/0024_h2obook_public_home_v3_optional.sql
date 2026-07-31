-- OPTIONAL. Claude Code must reconcile this with the current migration chain and RLS helpers.
create table if not exists public.public_home_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  slug text not null default 'main',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists public_home_configs_status_idx on public.public_home_configs(status,slug);
alter table public.public_home_configs enable row level security;

-- Public can only read the published main homepage payload.
create policy "public read published homepage"
on public.public_home_configs for select
to anon, authenticated
using (status = 'published' and slug = 'main');

-- Write policies must be mapped to the repository's real organization role helper before production use.
