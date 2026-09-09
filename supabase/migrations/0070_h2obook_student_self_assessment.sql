-- Student self-assessment is deliberately separate from the instructor's official evaluation.
-- A student may revise their reflection until a teacher saves the official class_evaluation.

alter table public.class_session_submissions
  add column if not exists rubric_id uuid references public.rubrics(id) on delete set null,
  add column if not exists rubric_version_label text not null default '',
  add column if not exists criterion_scores jsonb not null default '{}'::jsonb,
  add column if not exists self_total_score numeric(6,2),
  add column if not exists self_max_score numeric(6,2),
  add column if not exists self_duration_minutes integer;

alter table public.class_session_submissions
  drop constraint if exists class_session_submissions_self_duration_check;
alter table public.class_session_submissions
  add constraint class_session_submissions_self_duration_check
  check (self_duration_minutes is null or self_duration_minutes between 1 and 600);

create index if not exists class_session_submissions_rubric_idx
  on public.class_session_submissions(rubric_id)
  where rubric_id is not null;
