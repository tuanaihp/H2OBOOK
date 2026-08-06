-- H2OBOOK — persist per-criterion grading so the student can see it
--
-- Audit before adding anything. The assignment transaction the audit asks for is almost entirely
-- built already, on the 0026 "Brain" tables rather than the older class-based pair from 0002:
--   * assignment_definitions — instructions, submission_types, max/passing score, rubric_id, and
--     allow_resubmission, so per-assignment rubrics and resubmission are modelled.
--   * brain_assignment_submissions — status on the submission_status enum
--     (draft / submitted / in_review / revision_requested / graded), score, instructor_feedback,
--     graded_by, graded_at, and portfolio_ready from 0029. No unique constraint on
--     (assignment_id, user_id), so multiple attempts are already allowed: the history the audit
--     wants is a query, not a schema change.
--   * rubrics + rubric_criteria — per-criterion titles and max scores.
-- No new table is needed for any of that, and none is created here.
--
-- The one real gap: lib/teaching/grading.ts collects criteria: RubricCriterionScore[] from the
-- instructor, feeds them to evaluateFeedbackReadiness(), then stores only the resulting percentage
-- and one block of written feedback. The per-criterion detail — the part that tells a learner
-- which specific thing to fix — is computed and thrown away. Feedback that says "72%" teaches
-- nothing; feedback that says which criterion failed teaches the next attempt.
--
-- Stored as jsonb on the submission rather than as a child table: these scores are only ever read
-- back with their own submission, never queried across submissions, and a table would add a join
-- and a second RLS surface for no gain.

begin;

alter table public.brain_assignment_submissions
  add column if not exists criterion_scores jsonb not null default '[]'::jsonb;

comment on column public.brain_assignment_submissions.criterion_scores is
  'Per-criterion grading captured at grade time: [{criterionId, score, maxScore, required}]. Written by lib/teaching/grading.ts, read by the student submission view. Empty array means the submission has not been graded, or was graded before this column existed.';

commit;

-- Rollback:
--   alter table public.brain_assignment_submissions drop column if exists criterion_scores;
-- Additive with a default, so existing rows read as "no per-criterion detail" and nothing that
-- worked before this migration behaves differently after it.
