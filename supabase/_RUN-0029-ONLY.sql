-- H2OBOOK Teaching Intelligence Center V1
-- Adapted from v5/12-h2obook-teaching-intelligence-center-v1. The reference migration proposed
-- 7 new tables (teach_role_assignments, teach_scope_assignments, teach_student_interventions,
-- teach_feedback_templates, teach_feedback_events, teach_content_review_assignments,
-- teach_rule_preferences) plus is_teach_admin()/can_teach_scope() helpers.
--
-- Audit result: this repo already has a real role system (public.member_role via
-- organization_members, checked with public.has_org_role()) and a real class-scope model
-- (public.classes.teacher_id / public.class_members) — see lib/auth/current-user.ts and
-- lib/auth/api.ts's resolveOrganizationAccess(). Introducing teach_role_assignments and
-- teach_scope_assignments would create a second, parallel identity/scope system that the app
-- would then have to keep in sync with organization_members and classes.teacher_id forever.
-- Instead: 'teacher' membership role + classes.teacher_id/class_members are the source of
-- truth for who teaches whom (see lib/teaching/access.ts).
--
-- Grading itself already has a real table (public.brain_assignment_submissions, 0026) and a
-- legacy one (public.assignment_submissions, 0002) — both already carry score/instructor_feedback
-- /status/graded_by/graded_at, so teach_feedback_events would just be a duplicate audit copy of
-- the same decision. The one piece those tables cannot express is a "portfolio-ready" decision
-- (distinct from a normal pass) on brain_assignment_submissions, so this migration adds a single
-- additive boolean column for that instead of introducing a parallel events table.
--
-- teach_feedback_templates, teach_content_review_assignments and teach_rule_preferences are
-- genuinely deferred for this pass (see docs/H2OBOOK-TEACHING-INTELLIGENCE-CENTER-V1-INTEGRATION-REPORT.md
-- §Risks/TODO) — Content & Approval reuses the existing /reviews + review_requests engine as-is,
-- and Automation rule toggles were out of scope for a first, real-data pass of the Teach surface.
--
-- The one genuinely new concept with no existing home is a private instructor note / action log
-- tied to a specific at-risk student ("Risk Radar" intervention) — that is real net-new data, so
-- it gets one new table: public.teach_student_interventions.

begin;

alter table public.brain_assignment_submissions
  add column if not exists portfolio_ready boolean not null default false;

create table public.teach_student_interventions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_user_id uuid not null references public.profiles(id) on delete cascade,
  teacher_user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  risk_level text not null check (risk_level in ('watch','attention','critical')),
  reason_codes text[] not null default '{}',
  action_type text not null check (action_type in ('message','assignment','meeting','resource','stage_review','other')),
  note text,
  status text not null default 'open' check (status in ('open','scheduled','completed','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teach_student_interventions_student_idx on public.teach_student_interventions(organization_id, student_user_id, status);
create index teach_student_interventions_teacher_idx on public.teach_student_interventions(organization_id, teacher_user_id, status);

alter table public.teach_student_interventions enable row level security;

-- Read: the owning teacher, the student themself, or org owner/admin.
create policy "interventions read own org scope"
on public.teach_student_interventions for select
to authenticated
using (
  teacher_user_id = auth.uid()
  or student_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
);

-- Insert: only a real 'teacher' (or owner/admin) of the organization, and only as themself.
create policy "interventions teacher insert"
on public.teach_student_interventions for insert
to authenticated
with check (
  teacher_user_id = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','teacher']::public.member_role[])
);

create policy "interventions teacher update"
on public.teach_student_interventions for update
to authenticated
using (
  teacher_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
)
with check (
  teacher_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
);

create trigger teach_student_interventions_domain_event after insert or update or delete on public.teach_student_interventions
for each row execute function public.capture_domain_event();
do $$ begin
  alter publication supabase_realtime add table public.teach_student_interventions;
exception when duplicate_object then null;
end $$;

-- 0027 only ever gave staff a broad, unscoped SELECT on create_outcome_projects ("outcome
-- projects staff read") and explicitly deferred real per-class scoping. This adds the missing
-- UPDATE path (needed for Feedback Studio's portfolio review action) scoped to the project
-- owner's actual class teacher — not just "any teacher in the org" — so an instructor can only
-- move a portfolio project to approved/in_progress for a student in one of their own classes.
create policy "outcome projects teacher review update"
on public.create_outcome_projects for update
to authenticated
using (
  owner_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  or exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.user_id = create_outcome_projects.owner_user_id
      and cm.status = 'active'
      and c.teacher_id = auth.uid()
  )
)
with check (
  owner_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  or exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.user_id = create_outcome_projects.owner_user_id
      and cm.status = 'active'
      and c.teacher_id = auth.uid()
  )
);

commit;
