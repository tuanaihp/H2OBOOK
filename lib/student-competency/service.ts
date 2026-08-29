import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessClass, canAccessStudent } from "@/lib/teaching/access";
import type { TeachingAccessSnapshot } from "@/lib/teaching/types";
import { calculateGraduationStatus } from "./graduation";
import { aggregateCompetencyProfile } from "./competency";
import { CURRICULUM_DEFAULTS } from "./types";
import type { ClassSession, ClassEvaluation, ClassEvaluationAuditEntry, RubricView, RubricCriterionView, SessionType, GraduationResult, CompetencySkillPoint } from "./types";

// Service layer for the Student Management & Competency module (spec: v6-tich-hop-them). Reads go
// through the admin client + app-layer canAccessClass/canAccessStudent checks, matching
// lib/teaching/classes.ts and lib/teaching/students.ts; writes go through the request-scoped
// client so the RLS policies in migration 0060 are what actually enforce "instructor chỉ chấm lớp
// được phân công", matching lib/teaching/grading.ts's gradeBrainSubmission.

function mapSession(row: Record<string, unknown>): ClassSession {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    sessionNo: Number(row.session_no),
    sessionType: row.session_type as SessionType,
    title: String(row.title ?? ""),
    sessionDate: row.session_date ? String(row.session_date) : null,
    status: row.status as ClassSession["status"]
  };
}

function mapEvaluation(row: Record<string, unknown>): ClassEvaluation {
  return {
    id: String(row.id),
    classSessionId: String(row.class_session_id),
    studentId: String(row.student_id),
    rubricId: String(row.rubric_id),
    rubricVersionLabel: String(row.rubric_version_label ?? ""),
    totalScore: Number(row.total_score),
    maxScore: Number(row.max_score),
    criterionScores: (row.criterion_scores ?? {}) as Record<string, number>,
    notes: String(row.notes ?? ""),
    assetIds: (row.asset_ids ?? []) as string[],
    gradedBy: row.graded_by ? String(row.graded_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export async function listClassSessions(access: TeachingAccessSnapshot, classId: string): Promise<ClassSession[] | null> {
  if (!canAccessClass(access, classId)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("class_sessions").select("id,class_id,session_no,session_type,title,session_date,status")
    .eq("organization_id", access.organizationId).eq("class_id", classId).order("session_no", { ascending: true });
  return (data ?? []).map(mapSession);
}

export interface CreateSessionInput { sessionNo: number; sessionType: SessionType; title?: string; sessionDate?: string }

export async function createClassSessions(access: TeachingAccessSnapshot, classId: string, sessions: CreateSessionInput[]) {
  if (!canAccessClass(access, classId)) return { ok: false as const, error: "FORBIDDEN_CLASS_SCOPE" };
  if (!sessions.length) return { ok: false as const, error: "NO_SESSIONS" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const rows = sessions.map((s) => ({
    organization_id: access.organizationId, class_id: classId, session_no: s.sessionNo, session_type: s.sessionType,
    title: s.title ?? "", session_date: s.sessionDate ?? null, created_by: access.userId
  }));
  const { error } = await supabase.from("class_sessions").insert(rows);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, count: rows.length };
}

// Convenience for a brand-new class: seeds the standard 60-session curriculum shape (spec §2) in
// order, skipping session numbers that already exist so it is safe to call more than once.
export async function seedCurriculumSessions(access: TeachingAccessSnapshot, classId: string) {
  const existing = await listClassSessions(access, classId);
  if (existing === null) return { ok: false as const, error: "FORBIDDEN_CLASS_SCOPE" };
  const existingNos = new Set(existing.map((s) => s.sessionNo));
  const toCreate: CreateSessionInput[] = [];
  let sessionNo = 1;
  for (const group of CURRICULUM_DEFAULTS) {
    for (let i = 0; i < group.count; i++, sessionNo++) {
      if (!existingNos.has(sessionNo)) toCreate.push({ sessionNo, sessionType: group.type, title: "" });
    }
  }
  if (!toCreate.length) return { ok: true as const, count: 0 };
  return createClassSessions(access, classId, toCreate);
}

export async function listRubrics(access: TeachingAccessSnapshot, category?: "training" | "makeup" | "hair"): Promise<RubricView[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  let query = admin.from("rubrics").select("id,title,updated_at,category").eq("organization_id", access.organizationId);
  if (category) query = query.eq("category", category);
  const { data: rubricRows } = await query.order("updated_at", { ascending: false });
  const rubrics = rubricRows ?? [];
  if (!rubrics.length) return [];
  const rubricIds = rubrics.map((r) => String(r.id));
  const { data: criteriaRows } = await admin.from("rubric_criteria")
    .select("id,rubric_id,title,description,max_score,position,required,skill_key")
    .in("rubric_id", rubricIds).order("position", { ascending: true });
  const byRubric = new Map<string, RubricCriterionView[]>();
  for (const row of criteriaRows ?? []) {
    const list = byRubric.get(String(row.rubric_id)) ?? [];
    list.push({
      id: String(row.id), title: String(row.title), description: String(row.description ?? ""),
      maxScore: Number(row.max_score), position: Number(row.position), required: Boolean(row.required),
      skillKey: row.skill_key ? String(row.skill_key) : undefined
    });
    byRubric.set(String(row.rubric_id), list);
  }
  return rubrics.map((r) => ({ id: String(r.id), title: String(r.title), updatedAt: String(r.updated_at), criteria: byRubric.get(String(r.id)) ?? [] }));
}

export interface RosterMember { studentId: string; name: string; avatarUrl: string | null; joinedAt: string | null; status: string }

export async function getClassRoster(access: TeachingAccessSnapshot, classId: string): Promise<RosterMember[] | null> {
  if (!canAccessClass(access, classId)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data: memberRows } = await admin.from("class_members").select("user_id,status,joined_at").eq("class_id", classId).eq("role", "student");
  const studentIds = (memberRows ?? []).map((row) => String(row.user_id));
  if (!studentIds.length) return [];
  const { data: profileRows } = await admin.from("profiles").select("id,full_name,avatar_url").in("id", studentIds);
  const profileById = new Map((profileRows ?? []).map((row) => [String(row.id), row]));
  return (memberRows ?? []).map((row) => {
    const profile = profileById.get(String(row.user_id));
    return {
      studentId: String(row.user_id),
      name: String(profile?.full_name || "Học viên"),
      avatarUrl: profile?.avatar_url ? String(profile.avatar_url) : null,
      joinedAt: row.joined_at ? String(row.joined_at) : null,
      status: String(row.status)
    };
  });
}

export interface UpsertEvaluationInput {
  classSessionId: string;
  studentId: string;
  rubricId: string;
  criterionScores: Record<string, number>;
  notes?: string;
  assetIds?: string[];
}

/**
 * Saves one grading form (spec §4: chọn học viên + buổi → nhập điểm từng tiêu chí → lưu). Total
 * score is always computed server-side from rubric_criteria.max_score, never trusted from the
 * client. After saving, upserts one learning_skill_evidence row per criterion that declares a
 * skill_key (see migration 0060 + seed script), keyed by (student, skill, 'instructor',
 * 'class_evaluations', evaluation.id) so a later re-grade updates the same evidence rows instead
 * of appending duplicates — the evaluation row's id is stable across upserts because
 * class_evaluations has a unique(class_session_id,student_id) constraint.
 */
export async function upsertEvaluation(access: TeachingAccessSnapshot, input: UpsertEvaluationInput): Promise<{ ok: true; evaluation: ClassEvaluation } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const { data: session } = await admin.from("class_sessions").select("id,class_id").eq("id", input.classSessionId).eq("organization_id", access.organizationId).maybeSingle();
  if (!session) return { ok: false, error: "SESSION_NOT_FOUND" };
  if (!canAccessClass(access, String(session.class_id))) return { ok: false, error: "FORBIDDEN_CLASS_SCOPE" };
  if (!canAccessStudent(access, input.studentId)) return { ok: false, error: "FORBIDDEN_STUDENT_SCOPE" };
  const { data: membership } = await admin.from("class_members").select("user_id").eq("class_id", String(session.class_id)).eq("user_id", input.studentId).eq("role", "student").in("status", ["active", "completed"]).maybeSingle();
  if (!membership) return { ok: false, error: "STUDENT_NOT_IN_CLASS" };

  const { data: rubric } = await admin.from("rubrics").select("id,title,updated_at").eq("id", input.rubricId).eq("organization_id", access.organizationId).maybeSingle();
  if (!rubric) return { ok: false, error: "RUBRIC_NOT_FOUND" };
  const { data: criteriaRows } = await admin.from("rubric_criteria").select("id,max_score,required,skill_key").eq("rubric_id", input.rubricId);
  const criteria = (criteriaRows ?? []) as { id: string; max_score: number; required: boolean; skill_key: string | null }[];
  const maxScore = criteria.reduce((sum, c) => sum + Number(c.max_score), 0) || 100;
  const clampedScores: Record<string, number> = {};
  let totalScore = 0;
  for (const criterion of criteria) {
    const raw = input.criterionScores[String(criterion.id)];
    const score = typeof raw === "number" && Number.isFinite(raw) ? Math.min(Math.max(raw, 0), Number(criterion.max_score)) : 0;
    clampedScores[String(criterion.id)] = score;
    totalScore += score;
  }
  totalScore = Math.round(totalScore * 100) / 100;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const row = {
    organization_id: access.organizationId,
    class_session_id: input.classSessionId,
    student_id: input.studentId,
    rubric_id: input.rubricId,
    rubric_version_label: `${String(rubric.title)} · ${new Date(String(rubric.updated_at)).toLocaleDateString("vi-VN")}`,
    total_score: totalScore,
    max_score: maxScore,
    criterion_scores: clampedScores,
    notes: input.notes ?? "",
    asset_ids: input.assetIds ?? [],
    graded_by: access.userId,
    updated_at: new Date().toISOString()
  };
  const { data: saved, error } = await supabase.from("class_evaluations").upsert(row, { onConflict: "class_session_id,student_id" }).select("*").single();
  if (error || !saved) return { ok: false, error: error?.message ?? "EVALUATION_SAVE_FAILED" };

  const evidenceRows = criteria.filter((c) => c.skill_key).map((c) => {
    const raw = clampedScores[String(c.id)] ?? 0;
    const pct = Number(c.max_score) > 0 ? Math.round((raw / Number(c.max_score)) * 100) : 0;
    return {
      organization_id: access.organizationId, user_id: input.studentId, skill_key: String(c.skill_key),
      evidence_kind: "instructor", source_type: "class_evaluations", source_id: String(saved.id),
      score: pct, occurred_at: new Date().toISOString()
    };
  });
  if (evidenceRows.length) {
    await supabase.from("learning_skill_evidence").upsert(evidenceRows, { onConflict: "user_id,skill_key,evidence_kind,source_type,source_id" });
  }

  return { ok: true, evaluation: mapEvaluation(saved as Record<string, unknown>) };
}

export async function listEvaluationsForStudent(access: TeachingAccessSnapshot, classId: string, studentId: string): Promise<ClassEvaluation[] | null> {
  if (!canAccessClass(access, classId) || !canAccessStudent(access, studentId)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data: sessions } = await admin.from("class_sessions").select("id").eq("organization_id", access.organizationId).eq("class_id", classId);
  const sessionIds = (sessions ?? []).map((session) => String(session.id));
  if (!sessionIds.length) return [];
  const { data } = await admin.from("class_evaluations").select("*").eq("organization_id", access.organizationId).eq("student_id", studentId).in("class_session_id", sessionIds).order("created_at", { ascending: false });
  return (data ?? []).map((row) => mapEvaluation(row as Record<string, unknown>));
}

/**
 * Returns the immutable revision history for one evaluation.  The evaluation is joined back to
 * the requested class before returning anything, preventing a guessed UUID from crossing class
 * or organization boundaries even when using the admin read client.
 */
export async function listEvaluationAudit(access: TeachingAccessSnapshot, classId: string, evaluationId: string): Promise<ClassEvaluationAuditEntry[] | null> {
  if (!canAccessClass(access, classId)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data: sessionRows } = await admin.from("class_sessions").select("id").eq("organization_id", access.organizationId).eq("class_id", classId);
  const sessionIds = (sessionRows ?? []).map((row) => String(row.id));
  if (!sessionIds.length) return [];
  const { data } = await admin.from("class_evaluation_audit")
    .select("id,evaluation_id,student_id,action,changed_by,previous_total_score,current_total_score,previous_criterion_scores,current_criterion_scores,previous_notes,current_notes,created_at")
    .eq("organization_id", access.organizationId).eq("evaluation_id", evaluationId).in("class_session_id", sessionIds)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.some((row) => !canAccessStudent(access, String(row.student_id)))) return null;
  return rows.map((row) => ({
    id: String(row.id), evaluationId: String(row.evaluation_id), action: row.action as "created" | "updated",
    changedBy: row.changed_by ? String(row.changed_by) : null,
    previousTotalScore: row.previous_total_score == null ? null : Number(row.previous_total_score),
    currentTotalScore: Number(row.current_total_score),
    previousCriterionScores: row.previous_criterion_scores == null ? null : row.previous_criterion_scores as Record<string, number>,
    currentCriterionScores: (row.current_criterion_scores ?? {}) as Record<string, number>,
    previousNotes: row.previous_notes == null ? null : String(row.previous_notes),
    currentNotes: String(row.current_notes ?? ""), createdAt: String(row.created_at)
  }));
}

export interface GraduationOptions { supplementSessionsConfig?: number }

/**
 * Graduation eligibility per spec §F. "Đánh giá cuối khóa" (final assessment) is proxied as the
 * evaluation for the class's last practice session (highest session_no among
 * practice_makeup_hair/practice_hair) scoring >= 90/100 — there is no separate "final exam" table,
 * and inventing one for a single boolean would be exactly the kind of near-duplicate table this
 * module's audit avoided elsewhere (see migration 0060 header).
 */
export async function getGraduationForStudent(access: TeachingAccessSnapshot, classId: string, studentId: string, options?: GraduationOptions): Promise<GraduationResult | null> {
  if (!canAccessClass(access, classId) || !canAccessStudent(access, studentId)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const [{ data: sessionRows }, { data: evalRows }] = await Promise.all([
    admin.from("class_sessions").select("id,session_no,session_type").eq("organization_id", access.organizationId).eq("class_id", classId),
    admin.from("class_evaluations").select("id,class_session_id,rubric_id,total_score,max_score,criterion_scores,notes,asset_ids").eq("organization_id", access.organizationId).eq("student_id", studentId)
  ]);
  const sessions = (sessionRows ?? []) as { id: string; session_no: number; session_type: string }[];
  const sessionIds = new Set(sessions.map((s) => String(s.id)));
  const evals = ((evalRows ?? []) as { id: string; class_session_id: string; rubric_id: string; total_score: number; max_score: number; criterion_scores: Record<string, number>; notes: string; asset_ids: string[] }[])
    .filter((e) => sessionIds.has(String(e.class_session_id)));

  if (!evals.length) {
    return calculateGraduationStatus({ evaluations: [], requiredCriteriaMet: false, evidenceComplete: false, finalAssessmentPassed: false, supplementSessionsConfig: options?.supplementSessionsConfig });
  }

  const rubricIds = [...new Set(evals.map((e) => String(e.rubric_id)))];
  const { data: criteriaRows } = await admin.from("rubric_criteria").select("id,rubric_id,required").in("rubric_id", rubricIds);
  const requiredByRubric = new Map<string, string[]>();
  for (const row of (criteriaRows ?? []) as { id: string; rubric_id: string; required: boolean }[]) {
    if (!row.required) continue;
    const list = requiredByRubric.get(String(row.rubric_id)) ?? [];
    list.push(String(row.id));
    requiredByRubric.set(String(row.rubric_id), list);
  }

  let requiredCriteriaMet = true;
  let evidenceComplete = true;
  for (const evaluation of evals) {
    const requiredIds = requiredByRubric.get(String(evaluation.rubric_id)) ?? [];
    const scores = evaluation.criterion_scores ?? {};
    if (requiredIds.some((id) => !(id in scores))) requiredCriteriaMet = false;
    const hasEvidence = (evaluation.asset_ids?.length ?? 0) > 0 || Boolean(evaluation.notes && evaluation.notes.trim());
    if (!hasEvidence) evidenceComplete = false;
  }

  const practiceSessions = sessions.filter((s) => s.session_type === "practice_makeup_hair" || s.session_type === "practice_hair");
  const lastPracticeSessionNo = practiceSessions.length ? Math.max(...practiceSessions.map((s) => Number(s.session_no))) : 0;
  const finalSession = practiceSessions.find((s) => Number(s.session_no) === lastPracticeSessionNo);
  const finalEval = finalSession ? evals.find((e) => String(e.class_session_id) === String(finalSession.id)) : undefined;
  const finalAssessmentPassed = finalEval ? (Number(finalEval.total_score) / Number(finalEval.max_score)) * 100 >= 90 : false;

  return calculateGraduationStatus({
    evaluations: evals.map((e) => ({ totalScore: Number(e.total_score), maxScore: Number(e.max_score) })),
    requiredCriteriaMet, evidenceComplete, finalAssessmentPassed,
    supplementSessionsConfig: options?.supplementSessionsConfig
  });
}

export async function getCompetencyForStudent(access: TeachingAccessSnapshot, studentId: string): Promise<CompetencySkillPoint[] | null> {
  if (!canAccessStudent(access, studentId)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("learning_skill_evidence").select("skill_key,score,occurred_at")
    .eq("organization_id", access.organizationId).eq("user_id", studentId).eq("evidence_kind", "instructor");
  return aggregateCompetencyProfile((data ?? []).map((row) => ({ skillKey: String(row.skill_key), score: Number(row.score), occurredAt: String(row.occurred_at) })));
}

export interface ClassOverview {
  studentCount: number;
  totalSessions: number;
  completedSessions: number;
  sessionsByType: Partial<Record<SessionType, number>>;
  avgScore: number;
  passingRatioPercent: number;
  attentionCount: number;
  evidenceMissingCount: number;
}

export async function getClassOverview(access: TeachingAccessSnapshot, classId: string): Promise<ClassOverview | null> {
  if (!canAccessClass(access, classId)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const [{ data: classRow }, { data: sessionRows }, { data: memberRows }] = await Promise.all([
    admin.from("classes").select("total_sessions").eq("id", classId).maybeSingle(),
    admin.from("class_sessions").select("id,session_type,status").eq("class_id", classId).eq("organization_id", access.organizationId),
    admin.from("class_members").select("user_id").eq("class_id", classId).eq("role", "student").in("status", ["active", "completed"])
  ]);
  const sessions = (sessionRows ?? []) as { id: string; session_type: string; status: string }[];
  const sessionIds = sessions.map((s) => String(s.id));
  const { data: evalRows } = sessionIds.length
    ? await admin.from("class_evaluations").select("student_id,total_score,max_score,asset_ids,notes").in("class_session_id", sessionIds)
    : { data: [] as { student_id: string; total_score: number; max_score: number; asset_ids: string[]; notes: string }[] };
  const evals = (evalRows ?? []) as { student_id: string; total_score: number; max_score: number; asset_ids: string[]; notes: string }[];

  const percentScores = evals.filter((e) => Number(e.max_score) > 0).map((e) => (Number(e.total_score) / Number(e.max_score)) * 100);
  const avgScore = percentScores.length ? Math.round(percentScores.reduce((a, b) => a + b, 0) / percentScores.length) : 0;
  const passingRatioPercent = percentScores.length ? Math.round((percentScores.filter((s) => s >= 90).length / percentScores.length) * 100) : 0;

  const sessionsByType: Partial<Record<SessionType, number>> = {};
  for (const s of sessions) {
    const key = s.session_type as SessionType;
    sessionsByType[key] = (sessionsByType[key] ?? 0) + 1;
  }
  const evidenceMissingCount = evals.filter((e) => (e.asset_ids?.length ?? 0) === 0 && !(e.notes && e.notes.trim())).length;

  const byStudent = new Map<string, number[]>();
  for (const e of evals) {
    if (Number(e.max_score) <= 0) continue;
    const list = byStudent.get(String(e.student_id)) ?? [];
    list.push((Number(e.total_score) / Number(e.max_score)) * 100);
    byStudent.set(String(e.student_id), list);
  }
  let attentionCount = 0;
  for (const scores of byStudent.values()) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 70) attentionCount++;
  }

  return {
    studentCount: (memberRows ?? []).length,
    totalSessions: Number(classRow?.total_sessions ?? 60),
    completedSessions: sessions.filter((s) => s.status === "completed").length,
    sessionsByType,
    avgScore,
    passingRatioPercent,
    attentionCount,
    evidenceMissingCount
  };
}
