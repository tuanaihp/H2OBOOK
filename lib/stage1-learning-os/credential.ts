import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getJourneyForStudent } from "@/lib/learn-outcome/student";
import { loadCareerStages } from "@/lib/career-stages/service";
import { generateCertificateNo } from "./certificate-number";
import type { AcademyAdminAccess } from "@/lib/academy-admin/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const DONE_STATES = new Set(["verified", "result_achieved"]);

/**
 * Real Stage-completion eligibility — every real Mission in the Stage reached a done state. Shared
 * by lib/stage1-learning-os/passport.ts's read-only status and this file's issuance gate, so the two
 * can never disagree about what "eligible" means.
 */
export async function checkStage1Eligibility(organizationId: string, studentId: string, stageId: string): Promise<{ eligible: boolean; missionsTotal: number; missionsDone: number }> {
  const journey = await getJourneyForStudent(studentId, organizationId, stageId);
  if (!journey) return { eligible: false, missionsTotal: 0, missionsDone: 0 };
  const allMissions = journey.outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions));
  const missionsDone = allMissions.filter((m) => DONE_STATES.has(m.displayState)).length;
  return { eligible: allMissions.length > 0 && missionsDone === allMissions.length, missionsTotal: allMissions.length, missionsDone };
}

/**
 * Issues a real certificate_issues row (migration 0025 — the table already existed; only
 * /verify/[certificateNo] reading fake seed data instead of it was the gap, see
 * docs/stage1-learning-os-v1/01_PRODUCTION_AUDIT.md). owner/admin/teacher-triggered, not
 * self-service: certificate_issues has no student self-insert RLS policy at all (by design — see
 * migration 0025's own comment), so this always runs on the service-role client regardless of who
 * calls it — but the ELIGIBILITY check below is what is actually strict ("auto issue CHỈ khi
 * eligibility thật pass"), re-verified here even if the caller already saw "eligible" client-side.
 */
export async function issueStage1CertificateIfEligible(access: AcademyAdminAccess, studentId: string, stageId: string): Promise<Result<{ issued: boolean; certificateNo: string | null; reason?: string }>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };

  const existing = await admin.from("certificate_issues").select("certificate_no").eq("organization_id", access.organizationId).eq("student_id", studentId).contains("metadata", { stageId }).maybeSingle();
  if (existing.data) return { ok: true, data: { issued: true, certificateNo: (existing.data as { certificate_no: string }).certificate_no } };

  const eligibility = await checkStage1Eligibility(access.organizationId, studentId, stageId);
  if (!eligibility.eligible) return { ok: true, data: { issued: false, certificateNo: null, reason: `Chưa đủ điều kiện — mới hoàn thành ${eligibility.missionsDone}/${eligibility.missionsTotal} Nhiệm vụ.` } };

  const [stages, { data: profileRow }, { count }] = await Promise.all([
    loadCareerStages(access.organizationId, { includeHidden: true }),
    admin.from("profiles").select("full_name").eq("id", studentId).maybeSingle(),
    admin.from("certificate_issues").select("id", { count: "exact", head: true }).eq("organization_id", access.organizationId)
  ]);
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return { ok: false, error: "STAGE_NOT_FOUND" };
  const studentName = (profileRow as { full_name: string } | null)?.full_name || "Học viên";
  const certificateNo = generateCertificateNo(stage.slug, (count ?? 0) + 1);
  const verificationToken = crypto.randomUUID();

  const { error } = await admin.from("certificate_issues").insert({
    organization_id: access.organizationId, certificate_no: certificateNo, verification_token: verificationToken,
    student_id: studentId, student_name: studentName, course_name: stage.title, instructor_name: "H2OBOOK Academy",
    status: "valid", metadata: { stageId, missionsTotal: eligibility.missionsTotal }
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { issued: true, certificateNo } };
}

export interface PublicCertificateRecord { certificateNo: string; studentName: string; courseName: string; instructorName: string; issuedAt: string; status: "valid" | "revoked" | "expired" }

/**
 * Public, read-only lookup for /verify/[certificateNo] — certificate_issues has no public SELECT
 * policy at all (migration 0025's own comment: verification must go through a narrow server-side
 * lookup, never verification_token or organization_id). Returns only the 6 fields that comment
 * names; the admin client is used deliberately here, scoped down by this function's own select list,
 * not by RLS.
 */
export async function lookupPublicCertificate(certificateNo: string): Promise<PublicCertificateRecord | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("certificate_issues").select("certificate_no,student_name,course_name,instructor_name,issued_at,status").ilike("certificate_no", certificateNo).maybeSingle();
  if (!data) return null;
  const row = data as { certificate_no: string; student_name: string; course_name: string; instructor_name: string; issued_at: string; status: string };
  return { certificateNo: row.certificate_no, studentName: row.student_name, courseName: row.course_name, instructorName: row.instructor_name, issuedAt: row.issued_at, status: row.status as PublicCertificateRecord["status"] };
}
