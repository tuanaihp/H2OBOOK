-- H2OBOOK Admin Knowledge Gateway V1
--
-- Additive only. Does NOT create a "Knowledge Unit" table — curriculum_documents (migration 0045)
-- already has that exact shape (title/summary/body_markdown/tags/status) and is the table
-- lib/h2o-coach/repository.ts's getKnowledgeContext() already reads for Coach grounding. The
-- reference package (v5/40-.../supabase/migrations/0056_h2obook_admin_knowledge_gateway_v1.sql)
-- proposes 4 new tables (h2o_knowledge_sources/_units/_versions, h2o_mission_knowledge_links) built
-- with no awareness that this repo already has curriculum_documents + learning_mission_resource_
-- bindings serving the same purpose — copying it verbatim would create a second, parallel knowledge
-- system. Same reasoning for h2o_mission_intelligence_configs: coach_mission_configs (migration
-- 0057) already is the per-Mission coaching config table; only 3 genuinely new fields are added to
-- it below, not a second table.
--
-- Nothing here touches career_stages, learning_journey_missions, student_mission_states, or any
-- Journey Core table.

begin;

-- editorial_status is a NEW, separate concept from curriculum_documents.status: `status` has always
-- meant "visible or not" (active/hidden/archived — read by the Reader, career_stage_resources
-- placement, etc.) and keeps that exact meaning unchanged. editorial_status is the NEW draft->review
-- ->published->archived workflow this feature needs (a document can be `status='active'` — i.e.
-- previously not hidden from anything — while its content is edited through a new draft version).
-- Defaults to 'published' for every EXISTING row (they are real, already-live curriculum authored
-- before this feature existed — defaulting them to 'draft' would silently hide real content the
-- Coach and Reader already show today); the application layer explicitly writes 'draft' for new
-- Knowledge Gateway submissions.
alter table public.curriculum_documents add column if not exists editorial_status text not null default 'published' check (editorial_status in ('draft','review','published','archived'));
alter table public.curriculum_documents add column if not exists authority text not null default 'h2o_official' check (authority in ('h2o_official','external_reference','ai_suggestion'));
alter table public.curriculum_documents add column if not exists skill_code text;
alter table public.curriculum_documents add column if not exists current_published_version_id uuid;

create index if not exists curriculum_documents_editorial_status_idx on public.curriculum_documents(organization_id, editorial_status);
create index if not exists curriculum_documents_skill_code_idx on public.curriculum_documents(organization_id, skill_code) where skill_code is not null;

-- Version history — curriculum_documents itself has never had one. Mirrors the exact draft/publish
-- pointer shape learning_journey_blueprints/_versions (migration 0050) and coach_stage_profiles/
-- _versions (migration 0057) already use in this repo, for the third time this session.
create table if not exists public.curriculum_document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.curriculum_documents(id) on delete cascade,
  version_number integer not null,
  title text not null,
  summary text not null default '',
  body_markdown text not null default '',
  structured_content jsonb not null default '{}'::jsonb,
  change_note text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create index if not exists curriculum_document_versions_document_idx on public.curriculum_document_versions(document_id, version_number desc);

alter table public.curriculum_documents drop constraint if exists curriculum_documents_current_version_fk;
alter table public.curriculum_documents add constraint curriculum_documents_current_version_fk
  foreign key (current_published_version_id) references public.curriculum_document_versions(id) on delete set null;

alter table public.curriculum_document_versions enable row level security;
-- Same read/write shape curriculum_documents itself already uses (migration 0045) — org members read
-- non-archived, only owner/admin write. Draft version rows ARE readable at the RLS layer by any org
-- member (same "security by query shape" convention as every versioned table this session), but
-- getKnowledgeContext() only ever resolves through curriculum_documents.editorial_status='published',
-- so a draft is never actually surfaced to a student in practice.
drop policy if exists "curriculum document versions org read" on public.curriculum_document_versions;
create policy "curriculum document versions org read" on public.curriculum_document_versions for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists "curriculum document versions admin write" on public.curriculum_document_versions;
create policy "curriculum document versions admin write" on public.curriculum_document_versions for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

-- coach_mission_configs (migration 0057) gains the 3 fields the reference's separate
-- h2o_mission_intelligence_configs table would have duplicated: coach-internal behavior guidance
-- (distinct from the student-facing `objective` already on this table), a grading rubric, and
-- structured evidence requirements. requiredFields/questions/tools are untouched — that mechanism is
-- already built, tested (24 unit tests) and verified in production.
alter table public.coach_mission_configs add column if not exists coach_instructions text not null default '';
alter table public.coach_mission_configs add column if not exists rubric jsonb not null default '{}'::jsonb;
alter table public.coach_mission_configs add column if not exists evidence_requirements jsonb not null default '[]'::jsonb;

commit;

-- Rollback:
--   alter table public.coach_mission_configs drop column if exists coach_instructions;
--   alter table public.coach_mission_configs drop column if exists rubric;
--   alter table public.coach_mission_configs drop column if exists evidence_requirements;
--   alter table public.curriculum_documents drop constraint if exists curriculum_documents_current_version_fk;
--   drop table if exists public.curriculum_document_versions;
--   alter table public.curriculum_documents drop column if exists editorial_status;
--   alter table public.curriculum_documents drop column if exists authority;
--   alter table public.curriculum_documents drop column if exists skill_code;
--   alter table public.curriculum_documents drop column if exists current_published_version_id;
