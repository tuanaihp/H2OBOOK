import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canSubmit } from "./assignment-rules";
import type { CriterionScore, RubricCriterion, StudentAssignment, SubmissionAttempt, SubmissionStatus } from "./assignment-rules";

// Re-exported so callers keep one import path for the domain even though the rules live in a
// file the client can also reach.
export * from "./assignment-rules";

// The student half of the assignment transaction. The instructor half already exists
// (lib/teaching/grading.ts, lib/teaching/submissions.ts) on the 0026 tables; what was missing is
// everything a learner does: see what is assigned, submit, read the feedback, and try again.
//
// Reads use the admin client because a submission spans assignment_definitions, rubrics and the
// student's own rows; every query below is filtered by the caller's own user id, which is resolved
// from the session in the API route and never taken from the request body.

type DefinitionRow = {
  id: string; title: string; instructions: string; submission_types: string[] | null;
  max_score: number; passing_score: number; allow_resubmission: boolean; rubric_id: string | null;
};

type SubmissionRow = {
  id: string; assignment_id: string; status: SubmissionStatus; text_response: string;
  asset_ids: string[] | null; score: number | null; instructor_feedback: string | null;
  criterion_scores: CriterionScore[] | null; portfolio_ready: boolean | null;
  submitted_at: string | null; graded_at: string | null; created_at: string;
};

function mapAttempt(row: SubmissionRow): SubmissionAttempt {
  return {
    id: String(row.id),
    status: row.status,
    textResponse: String(row.text_response ?? ""),
    assetIds: Array.isArray(row.asset_ids) ? row.asset_ids.map(String) : [],
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    instructorFeedback: row.instructor_feedback ?? null,
    criterionScores: Array.isArray(row.criterion_scores) ? row.criterion_scores : [],
    portfolioReady: Boolean(row.portfolio_ready),
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    createdAt: row.created_at
  };
}

export async function getStudentAssignments(userId: string, organizationId: string): Promise<StudentAssignment[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data: definitionRows } = await admin
    .from("assignment_definitions")
    .select("id,title,instructions,submission_types,max_score,passing_score,allow_resubmission,rubric_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  const definitions = (definitionRows ?? []) as DefinitionRow[];
  if (definitions.length === 0) return [];

  const rubricIds = [...new Set(definitions.map((row) => row.rubric_id).filter((id): id is string => Boolean(id)))];
  const [{ data: criteriaRows }, { data: submissionRows }] = await Promise.all([
    rubricIds.length
      ? admin.from("rubric_criteria").select("id,rubric_id,title,description,max_score,position").in("rubric_id", rubricIds).order("position", { ascending: true })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    admin
      .from("brain_assignment_submissions")
      .select("id,assignment_id,status,text_response,asset_ids,score,instructor_feedback,criterion_scores,portfolio_ready,submitted_at,graded_at,created_at")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
  ]);

  const criteriaByRubric = new Map<string, RubricCriterion[]>();
  for (const row of (criteriaRows ?? []) as Record<string, unknown>[]) {
    const rubricId = String(row.rubric_id);
    const list = criteriaByRubric.get(rubricId) ?? [];
    list.push({ id: String(row.id), title: String(row.title), description: String(row.description ?? ""), maxScore: Number(row.max_score ?? 0), position: Number(row.position ?? 0) });
    criteriaByRubric.set(rubricId, list);
  }

  const attemptsByAssignment = new Map<string, SubmissionAttempt[]>();
  for (const row of (submissionRows ?? []) as SubmissionRow[]) {
    const key = String(row.assignment_id);
    attemptsByAssignment.set(key, [...(attemptsByAssignment.get(key) ?? []), mapAttempt(row)]);
  }

  return definitions.map((definition) => ({
    id: String(definition.id),
    title: String(definition.title),
    instructions: String(definition.instructions ?? ""),
    submissionTypes: Array.isArray(definition.submission_types) ? definition.submission_types.map(String) : ["text"],
    maxScore: Number(definition.max_score ?? 100),
    passingScore: Number(definition.passing_score ?? 70),
    allowResubmission: Boolean(definition.allow_resubmission),
    criteria: definition.rubric_id ? criteriaByRubric.get(definition.rubric_id) ?? [] : [],
    attempts: attemptsByAssignment.get(String(definition.id)) ?? []
  }));
}

export interface SubmitResult { ok: boolean; error?: string; submissionId?: string }

/**
 * Records an attempt. Always inserts rather than updating: the previous attempt and the feedback
 * attached to it are the record of what changed between tries, and overwriting it would erase the
 * reason the student was asked to redo the work.
 */
export async function submitAssignment(userId: string, organizationId: string, assignmentId: string, input: { textResponse: string; assetIds?: string[] }): Promise<SubmitResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const assignments = await getStudentAssignments(userId, organizationId);
  const assignment = assignments.find((candidate) => candidate.id === assignmentId);
  if (!assignment) return { ok: false, error: "ASSIGNMENT_NOT_FOUND" };
  if (!canSubmit(assignment)) {
    const latest = assignment.attempts[0];
    return { ok: false, error: latest?.status === "revision_requested" ? "RESUBMISSION_NOT_ALLOWED" : "ALREADY_SUBMITTED" };
  }
  if (!input.textResponse.trim() && (input.assetIds ?? []).length === 0) return { ok: false, error: "EMPTY_SUBMISSION" };

  const { data, error } = await admin.from("brain_assignment_submissions").insert({
    organization_id: organizationId,
    assignment_id: assignmentId,
    user_id: userId,
    status: "submitted",
    text_response: input.textResponse.trim(),
    asset_ids: input.assetIds ?? [],
    submitted_at: new Date().toISOString()
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "SUBMIT_FAILED" };
  return { ok: true, submissionId: String(data.id) };
}

/** Approved work, for the portfolio. Only what an instructor explicitly marked portfolio-ready. */
export async function getPortfolioSubmissions(userId: string, organizationId: string) {
  const assignments = await getStudentAssignments(userId, organizationId);
  return assignments
    .flatMap((assignment) => assignment.attempts.filter((attempt) => attempt.portfolioReady).map((attempt) => ({ assignmentTitle: assignment.title, attempt })))
    .sort((a, b) => Date.parse(b.attempt.gradedAt ?? b.attempt.createdAt) - Date.parse(a.attempt.gradedAt ?? a.attempt.createdAt));
}
