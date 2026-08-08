-- H2OBOOK — Curriculum Content V2: enrich the 80 seeded resources with real teaching content
--
-- Prepares the schema for v5/26-H2OBOOK_CURRICULUM_CONTENT_V2_PRODUCTION. The source package's own
-- audit found the same thing this repo's own module-25 report already flagged: all 80 documents
-- seeded by migration 0045 share one identical 8-line skeleton after "## Mục tiêu" — a template, not
-- a lesson. V2 supplies real per-resource content (objectives, principles, a practice workflow, a
-- Makeup-industry case, required evidence, KPIs, common mistakes, coaching questions, a teacher note)
-- keyed by the same stable seed_key migration 0045 already put in place, so it upgrades in place
-- rather than creating anything new.
--
-- Two genuine schema gaps, not duplicates of existing columns:
--
-- 1. curriculum_documents has one flat body_markdown column. V2's content is structured (objectives,
--    principles, workflow, evidence, kpis, mistakes, coach questions, teacher note, completion
--    policy, H2O Brain classification hints) — useful to admin UI and H2O Brain as data, not just as
--    prose inside a Markdown blob. body_markdown still gets the fuller rendered article (so anything
--    that already reads body_markdown keeps working unmodified); structured_content is additive.
--
-- 2. Nothing marks how far a document's content has progressed past the V1 skeleton, so a second run
--    of the V2 upgrade (or a future V3) has no way to tell "still at seed baseline" apart from
--    "admin already edited this by hand, don't clobber it". content_version does that: the upgrade
--    only touches rows still at version 1, and bumps them to 2, mirroring the seed_key idempotency
--    pattern from 0045/0041 one level down, at the field-content grain rather than the row-existence
--    grain.
--
-- career_stages.playbook is the same shape of gap one level up: each V2 stage file carries a
-- stage-wide practice rhythm (promise, weekly rhythm, business focus, coach focus, stage KPIs) that
-- has no home in career_stages' existing scalar columns (title/subtitle/description/duration_label/
-- skills) without overloading one of them to mean something it doesn't.
--
-- Explicitly NOT done here: the source package's "reconcile 5 legacy stages into 6" step
-- (docs/01_LEGACY_5_STAGE_RECONCILIATION.md). That assumes production is still showing 5 live legacy
-- stages needing careful ID-preserving remapping. Checked directly against production first: the 5
-- legacy stages (plus 2 stray manually-created ones) are already status='archived', and the 6 stages
-- this content upgrades are already the only active ones, seeded independently by module 25 rather
-- than by renaming the legacy rows. There is nothing live left to reconcile.

begin;

alter table public.curriculum_documents add column if not exists structured_content jsonb not null default '{}'::jsonb;
alter table public.curriculum_documents add column if not exists content_version integer not null default 1;

alter table public.career_stages add column if not exists playbook jsonb not null default '{}'::jsonb;

commit;

-- Rollback:
--   alter table public.career_stages drop column if exists playbook;
--   alter table public.curriculum_documents drop column if exists content_version;
--   alter table public.curriculum_documents drop column if exists structured_content;
