import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { evaluateFeedbackReadiness } from "./feedback";
import { canAccessStudent } from "./access";
import type { RubricCriterionScore, SubmissionDecision, TeachingAccessSnapshot } from "./types";

export interface GradeBrainSubmissionInput {
  criteria: RubricCriterionScore[];
  writtenFeedback: string;
  skillKey?: string;
  skillScore?: number;
  learnerReflectionComplete: boolean;
  confirmPortfolioReady: boolean;
}

export interface GradeResult {
  ok: boolean;
  error?: string;
  decision?: SubmissionDecision;
  scorePercent?: number;
}

// A readiness score of "portfolio_ready" from evaluateFeedbackReadiness() is only ever a
// suggestion — it is downgraded to "passed" unless the instructor explicitly ticks
// confirmPortfolioReady, per the module's non-negotiable rule that AI/rule-engines cannot
// finalize a portfolio-ready decision on their own (CLAUDE_INTEGRATION_PROMPT.md §F).
export async function gradeBrainSubmission(access: TeachingAccessSnapshot, submissionId: string, input: GradeBrainSubmissionInput): Promise<GradeResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const { data: submission } = await supabase
    .from("brain_assignment_submissions")
    .select("id,user_id,organization_id")
    .eq("id", submissionId)
    .eq("organization_id", access.organizationId)
    .maybeSingle();
  if (!submission) return { ok: false, error: "SUBMISSION_NOT_FOUND" };
  if (!canAccessStudent(access, String(submission.user_id))) return { ok: false, error: "FORBIDDEN_STUDENT_SCOPE" };

  const readiness = evaluateFeedbackReadiness({
    criteria: input.criteria,
    hasWrittenFeedback: input.writtenFeedback.trim().length > 0,
    hasSkillEvidence: Boolean(input.skillKey),
    learnerReflectionComplete: input.learnerReflectionComplete
  });
  const decision: SubmissionDecision = readiness.decision === "portfolio_ready" && !input.confirmPortfolioReady ? "passed" : readiness.decision;
  const status = decision === "needs_revision" ? "revision_requested" : "graded";

  const { error: updateError } = await supabase
    .from("brain_assignment_submissions")
    .update({
      status,
      score: readiness.scorePercent,
      instructor_feedback: input.writtenFeedback,
      // Persisted so the student can see which criterion fell short, not just the total. A score
      // of 72%% tells a learner nothing about what to change on the next attempt.
      criterion_scores: input.criteria,
      graded_by: access.userId,
      graded_at: new Date().toISOString(),
      portfolio_ready: decision === "portfolio_ready"
    })
    .eq("id", submissionId);
  if (updateError) return { ok: false, error: updateError.message };

  if (decision !== "needs_revision" && input.skillKey) {
    await supabase.from("learning_skill_evidence").upsert({
      organization_id: access.organizationId,
      user_id: submission.user_id,
      skill_key: input.skillKey,
      evidence_kind: "instructor",
      source_type: "brain_assignment_submissions",
      source_id: submissionId,
      score: input.skillScore ?? readiness.scorePercent,
      occurred_at: new Date().toISOString()
    }, { onConflict: "user_id,skill_key,evidence_kind,source_type,source_id" });
  }

  return { ok: true, decision, scorePercent: readiness.scorePercent };
}

export interface GradeLegacySubmissionInput {
  score: number;
  feedback: string;
  decision: "graded" | "returned";
}

export async function gradeLegacySubmission(access: TeachingAccessSnapshot, submissionId: string, input: GradeLegacySubmissionInput): Promise<GradeResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const { data: submission } = await supabase
    .from("assignment_submissions")
    .select("id,student_id,assignments!inner(organization_id)")
    .eq("id", submissionId)
    .eq("assignments.organization_id", access.organizationId)
    .maybeSingle();
  if (!submission) return { ok: false, error: "SUBMISSION_NOT_FOUND" };
  if (!canAccessStudent(access, String(submission.student_id))) return { ok: false, error: "FORBIDDEN_STUDENT_SCOPE" };

  const { error } = await supabase
    .from("assignment_submissions")
    .update({ score: input.score, feedback: input.feedback, status: input.decision, graded_by: access.userId, graded_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reviewOutcomeProject(access: TeachingAccessSnapshot, projectId: string, decision: "approved" | "in_progress", note: string): Promise<GradeResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const { data: project } = await supabase
    .from("create_outcome_projects")
    .select("id,owner_user_id,content")
    .eq("id", projectId)
    .eq("organization_id", access.organizationId)
    .maybeSingle();
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  if (!canAccessStudent(access, String(project.owner_user_id))) return { ok: false, error: "FORBIDDEN_STUDENT_SCOPE" };

  const nextContent = { ...(project.content as Record<string, unknown> ?? {}), instructorReview: { decision, note, reviewedBy: access.userId, reviewedAt: new Date().toISOString() } };
  const { error } = await supabase.from("create_outcome_projects").update({ status: decision, content: nextContent }).eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
