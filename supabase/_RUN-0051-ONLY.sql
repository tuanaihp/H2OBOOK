-- H2OBOOK — evidence storage for Learn Outcome OS mission states (Release B)
--
-- Release A (migration 0050) built student_mission_states with a state machine that includes
-- evidence_pending / review_pending / verified, but nowhere to actually put the evidence itself.
-- The plan was to reuse the existing assignment/submission/portfolio system
-- (brain_assignment_submissions + portfolio_ready) rather than build a second one — but
-- assignment_definitions is empty for this organization (confirmed by direct query before writing
-- this), and the Release B spec explicitly forbids inventing assignment rows just to have somewhere
-- to attach evidence. A mission's evidence_required/teacher_verified completion policy is a
-- genuinely different, smaller thing than a rubric-graded submission: a student attaches a note
-- and/or an asset (real assets table, no new upload path) and, if the policy calls for it, a
-- teacher marks it reviewed. That is the gap this migration closes — on the row that already
-- exists to hold exactly this, not a new table alongside it.

begin;

alter table public.student_mission_states add column if not exists evidence jsonb not null default '[]'::jsonb;
alter table public.student_mission_states add column if not exists evidence_submitted_at timestamptz;
alter table public.student_mission_states add column if not exists verified_by uuid references public.profiles(id) on delete set null;

-- Migration 0050 gave owner/admin/teacher read on every student's mission state (for the Admin
-- Journey Builder's own preview) but not write — there was no verify action yet to need it. Teacher
-- verify (docs/learn-outcome-os Release B, mission.completion_policy='teacher_verified') needs
-- exactly that: mark another student's mission reviewed. Scoped to teacher/admin/owner only, same
-- role set the read policy already trusts.
drop policy if exists "student mission states teacher verify" on public.student_mission_states;
create policy "student mission states teacher verify" on public.student_mission_states for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[]));

commit;

-- Rollback:
--   drop policy if exists "student mission states teacher verify" on public.student_mission_states;
--   alter table public.student_mission_states drop column if exists verified_by;
--   alter table public.student_mission_states drop column if exists evidence_submitted_at;
--   alter table public.student_mission_states drop column if exists evidence;
