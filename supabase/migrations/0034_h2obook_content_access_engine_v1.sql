-- H2OBOOK Content Access Engine V1
--
-- Adapted from v5/18-h2obook-content-access-engine-v1. The source module proposes twelve new
-- ca_* tables. All twelve were rejected as duplicates of tables this repo already has — see
-- docs/H2OBOOK-CONTENT-ACCESS-ENGINE-V1-INTEGRATION-REPORT.md §2 for the full mapping. In short:
-- ca_learning_paths/ca_path_stages/ca_stage_resource_bindings are career_stages and
-- career_stage_resources (0033); ca_access_grants is entitlements (0001);
-- ca_student_package_subscriptions is memberships (0001); ca_access_packages is products;
-- ca_access_audit_logs is domain_events (0007, and module 17 already retired the separate audit
-- table); ca_resources mirrors books/academy_courses/publications; ca_resource_progress mirrors
-- academy_lesson_progress. The module's own README asks for exactly this audit first.
--
-- Its ca_is_org_admin() also had to go on its own merits, independent of duplication: it reads the
-- role from auth.jwt() -> 'user_metadata' ->> 'role'. user_metadata is user-writable, so anyone
-- who sets role:"admin" on themselves would have passed it. It also treats a token with no
-- organization claim as valid for every organization, and falls back to a workspace_members table
-- that does not exist here. This repo resolves roles from organization_members via
-- has_org_role(), which is what the policies below keep using.
--
-- What is adopted is the part that is genuinely missing here: richer unlock rules. Six additive
-- columns on the existing binding table, no new tables, no data touched. The accompanying pure
-- resolver (lib/content-access/resolver.ts) is where the precedence logic lives.

begin;

alter table public.career_stage_resources
  add column if not exists unlock_mode text not null default 'immediate'
    check (unlock_mode in ('immediate','stage_active','after_resource','progress_gte','date','manual')),
  -- References another row in this same table rather than a resource id, so a prerequisite is
  -- always something actually placed in the curriculum, not a dangling polymorphic pointer.
  add column if not exists prerequisite_binding_id uuid references public.career_stage_resources(id) on delete set null,
  add column if not exists required_progress numeric(5,2) check (required_progress >= 0 and required_progress <= 100),
  add column if not exists unlock_at timestamptz,
  add column if not exists requirement_type text not null default 'required'
    check (requirement_type in ('required','optional','bonus')),
  add column if not exists display_locations text[] not null default array['library','journey'];

-- 'immediate' keeps every row created before this migration behaving exactly as it did: available
-- as soon as its stage is unlocked, which is what the access column alone used to mean.
comment on column public.career_stage_resources.unlock_mode is
  'When the resource opens once its stage is reachable. Composes with access: access decides whether the stage matters at all (free_preview bypasses it), unlock_mode refines when inside the stage.';

create index if not exists career_stage_resources_prerequisite_idx
  on public.career_stage_resources(prerequisite_binding_id)
  where prerequisite_binding_id is not null;

commit;

-- Rollback:
--   alter table public.career_stage_resources
--     drop column if exists unlock_mode,
--     drop column if exists prerequisite_binding_id,
--     drop column if exists required_progress,
--     drop column if exists unlock_at,
--     drop column if exists requirement_type,
--     drop column if exists display_locations;
-- Purely additive with defaults that reproduce the previous behaviour, so dropping them restores
-- the prior state exactly and no existing row changes meaning in the meantime.
