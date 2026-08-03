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
