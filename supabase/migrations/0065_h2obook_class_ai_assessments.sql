-- ===========================================================================
-- 0065 — AI draft assessment of a student's session submission
-- ---------------------------------------------------------------------------
-- The student can ask an AI provider to pre-score their evidence against the
-- session's teacher rubric. This is ALWAYS a draft — the official score stays
-- in class_evaluations (0060), which AI/students cannot write. History is kept
-- (one row per analyze), each frozen with its rubric_snapshot.
-- Depends on 0060 (class_sessions) + 0063 (class_session_submissions).
-- ===========================================================================

begin;

create table if not exists public.class_ai_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  model text,
  rubric_snapshot jsonb not null default '[]'::jsonb,
  criterion_scores jsonb not null default '{}'::jsonb,
  total_score numeric(6,2),
  max_score numeric(6,2) not null default 100,
  summary text not null default '',
  priority_fixes text[] not null default '{}',
  source_note text not null default '',
  source_asset_ids uuid[] not null default '{}',
  status text not null default 'ai_draft' check (status in ('ai_draft', 'unavailable')),
  created_at timestamptz not null default now()
);
create index if not exists class_ai_assessments_session_student_idx
  on public.class_ai_assessments(class_session_id, student_id, created_at desc);
create index if not exists class_ai_assessments_student_class_idx
  on public.class_ai_assessments(student_id, class_id);

alter table public.class_ai_assessments enable row level security;

-- Read: org owner/admin, the graded student, or the assigned teacher of the class
-- (same shape as "class session submissions read scope" in 0063 — no class_members
-- reference so it cannot recurse).
drop policy if exists "class ai assessments read scope" on public.class_ai_assessments;
create policy "class ai assessments read scope" on public.class_ai_assessments for select
  using (
    public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
    or student_id = auth.uid()
    or exists (
      select 1 from public.class_sessions cs
      join public.classes c on c.id = cs.class_id
      where cs.id = class_ai_assessments.class_session_id and c.teacher_id = auth.uid()
    )
  );

-- Write: the student themself (the API route computes the scores server-side from
-- the provider; the client only sends classSessionId), or org owner/admin.
drop policy if exists "class ai assessments student write" on public.class_ai_assessments;
create policy "class ai assessments student write" on public.class_ai_assessments for all
  using (
    student_id = auth.uid()
    or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  )
  with check (
    student_id = auth.uid()
    or public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
  );

commit;
