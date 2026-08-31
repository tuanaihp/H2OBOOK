-- ===========================================================================
-- 0063 — Student-submitted evidence per class session (Makeup 60-session course)
-- ---------------------------------------------------------------------------
-- The student learning space gains a "Khóa Makeup 60 buổi" section where the
-- student uploads their own evidence photos per session BEFORE the instructor
-- grades. class_evaluations (0060) stays the instructor's graded record; this
-- table is the student's pre-grading submission, mirroring its asset_ids shape.
--
-- Depends on 0060 (class_sessions) and 0062 (RLS recursion fix on classes).
-- Idempotent where practical.
-- ===========================================================================

begin;

create table if not exists public.class_session_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  asset_ids uuid[] not null default '{}',
  note text not null default '',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_session_id, student_id)
);
create index if not exists class_session_submissions_student_idx
  on public.class_session_submissions(student_id, class_id);
create index if not exists class_session_submissions_session_idx
  on public.class_session_submissions(class_session_id);

alter table public.class_session_submissions enable row level security;

-- Read: org owner/admin, the graded student themself, or the assigned teacher of
-- that session's class (session -> class -> teacher_id chain, same shape as
-- "class evaluations read scope" in 0060 — does not go through class_members so
-- it cannot recurse).
drop policy if exists "class session submissions read scope" on public.class_session_submissions;
create policy "class session submissions read scope" on public.class_session_submissions for select
  using (
    public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
    or student_id = auth.uid()
    or exists (
      select 1 from public.class_sessions cs
      join public.classes c on c.id = cs.class_id
      where cs.id = class_session_submissions.class_session_id and c.teacher_id = auth.uid()
    )
  );

-- Write: the student themself (spec §7: "student chỉ xem hồ sơ của chính mình",
-- extended so a student may only write their OWN submission), or org owner/admin.
-- Teachers never write this table — they grade in class_evaluations.
drop policy if exists "class session submissions student write" on public.class_session_submissions;
create policy "class session submissions student write" on public.class_session_submissions for all
  using (
    student_id = auth.uid()
    or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  )
  with check (
    student_id = auth.uid()
    or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  );

commit;
