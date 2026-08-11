-- H2OBOOK — Journey Admin Builder V5: stable Mission identity across clones.
--
-- docs/journey-admin-v5/01_PRODUCTION_AUDIT.md found a real, present risk: duplicateVersion() gives
-- every cloned Mission a brand new UUID, and getJourneyForStudent() reads student_mission_states
-- filtered to the CURRENTLY published version's id. Publishing a new version over one real students
-- already have progress on would make that progress vanish from their UI (rows aren't deleted, they
-- just stop matching blueprint_version_id) — exactly the failure v5/33-.../CLAUDE_INTEGRATION_
-- PROMPT.md §13 says to "STOP and report the risk" over rather than build blindly.
--
-- root_mission_id is the fix: a self-referencing "identity anchor" that survives cloning. A Mission
-- created directly points at itself; a cloned Mission inherits its source's root_mission_id (not the
-- source's own id, so identity survives multiple clone generations: v1 -> v2 -> v3 all share one
-- root). lib/learn-outcome/admin.ts's publishVersion() uses this to repoint existing student
-- progress from the outgoing published version's Missions to the incoming version's Missions that
-- share the same root, before switching the blueprint's current_published_version_id — the "Safe
-- behavior" §13 describes, not a second unlock/progress system.

begin;

alter table public.learning_journey_missions add column if not exists root_mission_id uuid references public.learning_journey_missions(id) on delete set null;

-- Every existing Mission is its own root today (no prior clone had this column to inherit from).
update public.learning_journey_missions set root_mission_id = id where root_mission_id is null;

create index if not exists learning_journey_missions_root_idx on public.learning_journey_missions(root_mission_id);

commit;

-- Rollback:
--   drop index if exists public.learning_journey_missions_root_idx;
--   alter table public.learning_journey_missions drop column if exists root_mission_id;
