-- H2OBOOK — Contextual Resource Reader V1: reading progress + bookmark on curriculum_documents,
-- and letting a note attach to a document/Mission outside a Knowledge Space.
--
-- Audited first (v5/32-H2OBOOK_LEARN_OUTCOME_OS_V4 §1/§4, "reuse existing notes/bookmarks/reading
-- progress systems, do not create duplicates"):
--   - reading_progress (migration 0001) is scoped to publication_id/book_pages — the legacy
--     /reader/[slug] book reader — nothing in the app queries it for curriculum_documents, and nothing
--     analogous exists for that table.
--   - Bookmarks only exist as a per-book localStorage blob inside /reader/[slug] (client-only, no
--     table, no server route) — there is no server-backed bookmark concept to extend.
--   - learner_notes (migration 0026) is real and reusable, but knowledge_space_id is NOT NULL and
--     block_id only references learning_blocks — a note cannot attach to a curriculum_documents id or
--     a Mission today. Extended below rather than duplicated.
-- Conclusion: one small new table for reading progress + bookmark (they are the same "this student,
-- this resource" row and always read/written together), and an ALTER on learner_notes for resource
-- linking — not a second notes system.

begin;

create table if not exists public.student_resource_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  bookmarked boolean not null default false,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, student_id, resource_type, resource_id)
);

alter table public.student_resource_progress enable row level security;

drop policy if exists "resource progress own" on public.student_resource_progress;
create policy "resource progress own" on public.student_resource_progress for all to authenticated
using (student_id = auth.uid()) with check (student_id = auth.uid() and public.is_org_member(organization_id));

-- Generalizing learner_notes for resource-linked notes (the Reader's "Lưu vào Học & ghi nhớ"):
-- knowledge_space_id becomes optional, and a note may instead carry resource_type/resource_id
-- (matching student_resource_progress's shape) plus an optional mission_id for "why I was reading
-- this". Existing Knowledge-Space notes are untouched — they keep knowledge_space_id set and simply
-- leave the new columns null.
alter table public.learner_notes alter column knowledge_space_id drop not null;
alter table public.learner_notes add column if not exists resource_type text;
alter table public.learner_notes add column if not exists resource_id uuid;
alter table public.learner_notes add column if not exists mission_id uuid references public.learning_journey_missions(id) on delete set null;

alter table public.learner_notes drop constraint if exists learner_notes_has_a_subject;
alter table public.learner_notes add constraint learner_notes_has_a_subject
  check (knowledge_space_id is not null or (resource_type is not null and resource_id is not null));

create index if not exists student_resource_progress_student_idx on public.student_resource_progress(organization_id, student_id, resource_type);
create index if not exists learner_notes_resource_idx on public.learner_notes(resource_type, resource_id) where resource_id is not null;

drop trigger if exists student_resource_progress_domain_event on public.student_resource_progress;
create trigger student_resource_progress_domain_event after insert or update on public.student_resource_progress
for each row execute function public.capture_domain_event();

commit;

-- Rollback:
--   drop trigger if exists student_resource_progress_domain_event on public.student_resource_progress;
--   drop table if exists public.student_resource_progress;
--   alter table public.learner_notes drop constraint if exists learner_notes_has_a_subject;
--   alter table public.learner_notes drop column if exists mission_id;
--   alter table public.learner_notes drop column if exists resource_id;
--   alter table public.learner_notes drop column if exists resource_type;
--   -- knowledge_space_id is left nullable on rollback (making it NOT NULL again would fail if any
--   -- resource-linked note rows still exist; delete those first if a full rollback is required).
