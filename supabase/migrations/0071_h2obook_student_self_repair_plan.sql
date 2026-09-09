-- The learner's plan for correcting a specific session is separate from both AI advice and the
-- instructor's official evaluation. It is a compact, bounded JSON list (maximum three focus
-- criteria is enforced by the application) so the teacher can review the learner's intent.

alter table public.class_session_submissions
  add column if not exists self_repair_plan jsonb not null default '[]'::jsonb;
