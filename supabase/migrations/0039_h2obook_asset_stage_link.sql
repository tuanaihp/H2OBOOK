-- H2OBOOK — let an asset be attached to a career stage
--
-- This is the schema decision module 0038 deliberately left open, now taken.
--
-- Module 19 proposed a dedicated asset_stage_links table. That was rejected in
-- docs/asset-governance-integration-audit.md §4 because career_stage_resources (0033) already maps
-- a stage to a thing by resource_type + resource_id, and the content access resolver (0034) reads
-- it — a second mapping would re-fragment exactly what 0033/0034 unified. The audit said the right
-- move, if raw assets ever needed attaching to a stage, was to widen that column rather than build
-- a parallel path. This does that.
--
-- Consequence worth stating plainly, because it is the reason the decision was deferred rather than
-- taken casually: an asset attached this way is a curriculum resource, so the access engine governs
-- it like any other. That is deliberate. The alternative — a link that means "intended for stage 3"
-- but grants nothing — is a note, and notes belong in the asset's own metadata, not in the table
-- the access engine trusts. If a purely advisory link is wanted later, assets.metadata is where it
-- goes, not here.
--
-- Attaching is already possible with no new UI: Academy Admin -> Giai đoạn & tài liệu has a resource
-- picker driven by the same list this constraint holds.

begin;

alter table public.career_stage_resources drop constraint if exists career_stage_resources_resource_type_check;

alter table public.career_stage_resources
  add constraint career_stage_resources_resource_type_check
  check (resource_type in ('book','course','publication','template','knowledge_space','roadmap','link','asset'));

commit;

-- Rollback:
--   Any rows with resource_type = 'asset' must be removed or re-typed first, or the narrower
--   constraint cannot be re-applied:
--     delete from public.career_stage_resources where resource_type = 'asset';
--   then:
--     alter table public.career_stage_resources drop constraint if exists career_stage_resources_resource_type_check;
--     alter table public.career_stage_resources
--       add constraint career_stage_resources_resource_type_check
--       check (resource_type in ('book','course','publication','template','knowledge_space','roadmap','link'));
