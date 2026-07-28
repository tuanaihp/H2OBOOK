-- OPTIONAL: chỉ áp dụng sau khi module local đã được nghiệm thu.
create table if not exists public.design_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  category text not null check (category in ('fanpage-cover','personal-profile','student-invitation','makeup-certificate','makeup-promotion')),
  subcategory text not null default '',
  style text not null,
  base_format text not null,
  supported_formats jsonb not null default '[]'::jsonb,
  field_schema jsonb not null default '[]'::jsonb,
  template_payload jsonb not null,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  version integer not null default 1,
  approval_required boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug, version)
);

create table if not exists public.design_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.design_templates(id),
  book_id uuid references public.books(id),
  title text not null,
  category text not null,
  format_key text not null,
  smart_field_values jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','approved','published','archived')),
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificate_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  design_project_id uuid not null references public.design_projects(id) on delete cascade,
  student_id uuid,
  certificate_no text not null,
  student_name text not null,
  course_name text not null,
  verification_token text not null default encode(gen_random_bytes(16),'hex'),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id, certificate_no),
  unique (verification_token)
);

alter table public.design_templates enable row level security;
alter table public.design_projects enable row level security;
alter table public.certificate_issues enable row level security;

-- Điều chỉnh helper membership theo schema thật của repository trước khi chạy.
