-- H2OBOOK Stage Workspace V3 — publish timestamps only
--
-- Adapted from v5/23-h2obook-stage-workspace-v3. The source module is a UI/UX design (3-pane
-- Structure Explorer / Content Canvas / Inspector, Stage Health, Preflight, Resource Picker) backed
-- entirely by a mock repository — no real schema decisions were made in it beyond a wishlist of
-- columns. Nearly every proposed column on career_stage_resources already exists under a different
-- name from migrations 0033/0034/0036/0041:
--
--   resource_role      -> requirement_type   (required/optional/bonus — already a check constraint)
--   access_mode         -> access             (free_preview/stage_locked/entitlement_only)
--   unlock_resource_id  -> prerequisite_binding_id
--   sort_order          -> position
--   featured            -> is_featured        (migration 0041)
--   visible             -> status <> 'hidden'
--   node_id, surface     -> already added in migration 0041, no-ops here
--
-- Adding a second column for each of these is the exact duplication pattern flagged in every audit
-- this session (media_assets vs assets, unlock_rule vs unlock_mode, student_label vs title_override,
-- ...). None of it is added. The one genuine gap — a stage cannot record when it was published or
-- archived, which the new Preflight/Publish workflow needs — is filled here. Health scoring and
-- preflight checks are computed from existing data at read time (lib/academy-control/health.ts),
-- not stored.

begin;

alter table public.career_stages add column if not exists published_at timestamptz;
alter table public.career_stages add column if not exists archived_at timestamptz;

commit;

-- Rollback:
--   alter table public.career_stages drop column if exists archived_at;
--   alter table public.career_stages drop column if exists published_at;
