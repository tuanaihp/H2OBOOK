-- H2OBOOK — a home for written curriculum material, and stable keys so a seed can be re-run
--
-- Prepares the schema for v5/25-H2OBOOK_SIX_STAGE_PRODUCTION_SEED_V1 (the ThuyH2O six-stage makeup
-- curriculum). Full findings in docs/module-25-six-stage-seed-audit.md; the two that forced schema
-- work:
--
-- 1. The manifest describes resources of twelve kinds — article, checklist, rubric, practice,
--    worksheet, template, assessment, case_study, sop, script, tool_guide, playbook. Only
--    'template' is in career_stage_resources.resource_type's allowed list, so eleven of twelve
--    would have failed the check constraint outright.
--
--    Those twelve are not twelve storage backends, though: they are twelve *kinds of written
--    document*. resource_type answers "which table holds this", so all twelve become one new value,
--    'document', and the distinction between an SOP and a checklist lives in
--    curriculum_documents.doc_type where it belongs.
--
-- 2. Each resource carries a Markdown body, and nothing in this database stores one. books needs
--    book_documents plus content_nodes; knowledge_spaces requires a content_item_id pointing at an
--    academy_course_lesson, so eighty short reference documents would have meant eighty fabricated
--    courses, modules and lessons purely to satisfy a foreign key. assets stores files in object
--    storage and has no body column at all. This is a genuine gap rather than a duplicate of
--    something existing, which is why a new table is the right answer here and was not in modules
--    19, 20, 21 or 22.

begin;

create table if not exists public.curriculum_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Stable identifier from the seed manifest. Null for anything an admin writes by hand, and the
  -- unique index below is partial so any number of hand-written documents can coexist — the exact
  -- Postgres NULL-distinctness behaviour that was a bug for asset folder names in 0037 is the
  -- wanted behaviour here.
  seed_key text,
  doc_type text not null default 'article' check (doc_type in (
    'article','checklist','rubric','practice','worksheet','template',
    'assessment','case_study','sop','script','tool_guide','playbook','assignment'
  )),
  title text not null,
  summary text not null default '',
  body_markdown text not null default '',
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active','hidden','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists curriculum_documents_seed_key_idx
  on public.curriculum_documents(organization_id, seed_key) where seed_key is not null;
create index if not exists curriculum_documents_org_type_idx
  on public.curriculum_documents(organization_id, doc_type, status);

-- Stable keys on the structural tables, for the same reason: re-running the seed has to find the
-- row it created last time rather than make a second one. Partial unique indexes so every stage and
-- node created by hand — which has no seed key — is unaffected.
alter table public.career_stages add column if not exists seed_key text;
create unique index if not exists career_stages_seed_key_idx
  on public.career_stages(organization_id, seed_key) where seed_key is not null;

alter table public.academy_stage_nodes add column if not exists seed_key text;
create unique index if not exists academy_stage_nodes_seed_key_idx
  on public.academy_stage_nodes(organization_id, seed_key) where seed_key is not null;

-- 'document' joins the resource kinds a stage can point at.
alter table public.career_stage_resources drop constraint if exists career_stage_resources_resource_type_check;
alter table public.career_stage_resources add constraint career_stage_resources_resource_type_check
  check (resource_type in ('book','course','publication','template','knowledge_space','roadmap','link','asset','document'));

-- ...and into the catalog, so written material is findable in Kho nội dung Academy beside books and
-- assets rather than being reachable only from the stage that happens to reference it.
alter table public.content_items drop constraint if exists content_items_content_type_check;
alter table public.content_items add constraint content_items_content_type_check
  check (content_type in ('book','publication','template','knowledge_space','asset','document'));

alter table public.content_items drop constraint if exists content_items_source_table_check;
alter table public.content_items add constraint content_items_source_table_check
  check (source_table in ('books','publications','templates','knowledge_spaces','assets','curriculum_documents'));

alter table public.curriculum_documents enable row level security;

-- Read is org-wide because students read curriculum material; only owner/admin may write it.
drop policy if exists "curriculum documents org read" on public.curriculum_documents;
create policy "curriculum documents org read" on public.curriculum_documents for select to authenticated
using (public.is_org_member(organization_id) and status <> 'archived');

drop policy if exists "curriculum documents admin write" on public.curriculum_documents;
create policy "curriculum documents admin write" on public.curriculum_documents for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop trigger if exists curriculum_documents_domain_event on public.curriculum_documents;
create trigger curriculum_documents_domain_event after insert or update or delete on public.curriculum_documents
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   drop trigger if exists curriculum_documents_domain_event on public.curriculum_documents;
--   drop table if exists public.curriculum_documents;
--   drop index if exists public.academy_stage_nodes_seed_key_idx;
--   alter table public.academy_stage_nodes drop column if exists seed_key;
--   drop index if exists public.career_stages_seed_key_idx;
--   alter table public.career_stages drop column if exists seed_key;
--   -- and narrow the three check constraints back, which first requires deleting every row that
--   -- uses 'document' / 'curriculum_documents'.
