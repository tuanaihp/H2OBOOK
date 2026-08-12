-- H2OBOOK — Stage 1 Learning OS V1: Daily Practice Journal needs photo/video evidence.
--
-- Audited first (docs/stage1-learning-os-v1/01_PRODUCTION_AUDIT.md): learner_notes (migration 0026,
-- generalized in 0053 to accept mission_id/resource_type/resource_id instead of requiring a
-- Knowledge Space) is the real, reusable home for Daily Practice entries — title/body/tags/mission_id
-- already exist. The one real gap: Daily Practice explicitly asks for "ảnh/video qua assets", and
-- learner_notes has no way to attach one. learner_experiences (0026) already has this exact shape
-- (asset_ids uuid[]) for a different, richer feature (Create Outcome experience case write-ups) — not
-- reused here because it is knowledge_space-scoped and carries a case-study rubric (subject_profile/
-- condition_analysis/etc.) that a daily practice log has no use for; adding one column to the lighter
-- table already generalized for exactly this purpose is the smaller, correct move.
--
-- "Teacher review" from the source package is explicitly conditional ("nếu có") and no
-- assignment/rubric is wired to Daily Practice — deferred, not built blind; documented as a gap in
-- the audit rather than adding an unused column.

begin;

alter table public.learner_notes add column if not exists asset_ids uuid[] not null default '{}';

commit;

-- Rollback:
--   alter table public.learner_notes drop column if exists asset_ids;
