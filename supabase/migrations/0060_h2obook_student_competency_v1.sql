-- H2OBOOK Student Management & Competency V1
-- Source package: v6-tich-hop-them/1-h2obook-student-manager. The reference package proposed 7
-- standalone tables (students, classes, sessions, rubric_definitions, evaluations,
-- learning_evidence, graduation_reviews) plus a parallel /api/student-management/* surface.
--
-- Audit result: 5 of those 7 concepts already have a real home in this schema —
--   - "students"            -> public.class_members (already joins profiles/auth.users; the
--                              reference table did not, which was its most serious flaw)
--   - "classes"             -> public.classes (0002) — only missing a total-session count
--   - "rubric_definitions"  -> public.rubrics + public.rubric_criteria (0026) — already
--                              versionable (create a new rubrics row) and already scores per
--                              criterion via rubric_criteria.max_score
--   - "learning_evidence"   -> public.assets (0001) — evidence photos/videos are assets;
--                              class_evaluations below references them via asset_ids uuid[],
--                              the same convention public.brain_assignment_submissions (0026)
--                              already uses
--   - permission scoping    -> lib/teaching/access.ts (teacher/admin/owner via
--                              classes.teacher_id + class_members), reused as-is
--
-- Genuine gap: public.assignment_definitions (0026) requires knowledge_space_id NOT NULL, so
-- every assignment must belong to a Knowledge Space/course — there is no way to grade "buổi học
-- số N của lớp X" without forcing a fake Knowledge Space, which would violate the no-parallel-
-- fake-data rule this repo already follows (see 0028's and 0029's own header comments). So this
-- migration adds exactly the two tables that concept requires: class_sessions (the 60 numbered
-- sessions of one class) and class_evaluations (one graded evaluation = one session + one
-- student + one rubric). Both are additive, org-scoped, and follow the RLS shape already used by
-- public.teach_student_interventions (0029).
--
-- graduation_reviews (reference package) is NOT created as a table: graduation status is
-- computed on read from class_evaluations (see lib/student-competency/graduation.ts), matching
-- this repo's existing preference for computed status over a persisted, potentially-stale review
-- row (see 0028's header comment on why h2o_learn_daily_tasks was not created either).

begin;

alter table public.classes add column if not exists total_sessions integer not null default 60;

-- Additive columns on the existing rubrics/rubric_criteria tables (0026) rather than a second
-- rubric_definitions table: category distinguishes Training/Makeup/Hair rubric sets (existing
-- knowledge-space rubrics keep category = null, unaffected); required/skill_key let a criterion
-- declare "must be met to graduate" and "which competency-profile skill this feeds" as real data
-- instead of parsing rubric_criteria.title at read time.
alter table public.rubrics add column if not exists category text check (category is null or category in ('training','makeup','hair'));
alter table public.rubric_criteria add column if not exists required boolean not null default false;
alter table public.rubric_criteria add column if not exists skill_key text;

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  session_no integer not null,
  session_type text not null check (session_type in ('training_makeup_hair','training_hair','practice_makeup_hair','practice_hair','extracurricular')),
  title text not null default '',
  session_date date,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_id,session_no)
);
create index class_sessions_class_idx on public.class_sessions(class_id,session_no);

-- rubric_version_label snapshots public.rubrics.title + updated_at at grading time, because
-- rubric_criteria rows can change later (see 0026 comment: rubrics are meant to be versioned by
-- creating a new rubrics row, not edited under existing evaluations) — the label lets a saved
-- evaluation still show what it was graded against even if the live rubric moves on.
create table public.class_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  rubric_id uuid not null references public.rubrics(id) on delete restrict,
  rubric_version_label text not null default '',
  total_score numeric(6,2) not null default 0,
  max_score numeric(6,2) not null default 100,
  criterion_scores jsonb not null default '{}'::jsonb,
  notes text not null default '',
  asset_ids uuid[] not null default '{}',
  graded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_session_id,student_id)
);
create index class_evaluations_student_idx on public.class_evaluations(student_id,created_at desc);
create index class_evaluations_session_idx on public.class_evaluations(class_session_id);

alter table public.class_sessions enable row level security;
alter table public.class_evaluations enable row level security;

-- Read: org owner/admin, the class's own teacher, or an active/completed member of the class
-- (covers the student themself). Mirrors public.classes / public.class_members access shape.
create policy "class sessions read scope" on public.class_sessions for select
  using (
    public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
    or exists (select 1 from public.classes c where c.id = class_sessions.class_id and c.teacher_id = auth.uid())
    or exists (select 1 from public.class_members cm where cm.class_id = class_sessions.class_id and cm.user_id = auth.uid() and cm.status in ('active','completed'))
  );
create policy "class sessions teacher write" on public.class_sessions for all
  using (
    public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
    or exists (select 1 from public.classes c where c.id = class_sessions.class_id and c.teacher_id = auth.uid())
  )
  with check (
    public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
    or exists (select 1 from public.classes c where c.id = class_sessions.class_id and c.teacher_id = auth.uid())
  );

-- Read: org owner/admin, the class's own teacher (via the session -> class chain), or the graded
-- student themself (spec §7: "student chỉ xem hồ sơ của chính mình").
create policy "class evaluations read scope" on public.class_evaluations for select
  using (
    public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
    or student_id = auth.uid()
    or exists (
      select 1 from public.class_sessions cs join public.classes c on c.id = cs.class_id
      where cs.id = class_evaluations.class_session_id and c.teacher_id = auth.uid()
    )
  );
-- Write: org owner/admin, or the assigned teacher of that session's class (spec §7: "instructor
-- chỉ chấm lớp được phân công") — never the student, matching §6's "AI/không ai khác tự sửa điểm
-- giáo viên" rule extended to self-grading.
create policy "class evaluations teacher write" on public.class_evaluations for all
  using (
    public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
    or exists (
      select 1 from public.class_sessions cs join public.classes c on c.id = cs.class_id
      where cs.id = class_evaluations.class_session_id and c.teacher_id = auth.uid()
    )
  )
  with check (
    public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
    or exists (
      select 1 from public.class_sessions cs join public.classes c on c.id = cs.class_id
      where cs.id = class_evaluations.class_session_id and c.teacher_id = auth.uid()
    )
  );

commit;
