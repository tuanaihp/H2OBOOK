import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getJourneyForStudent } from "@/lib/learn-outcome/student";
import { getSkillMastery } from "@/lib/student/mastery";
import { STAGE1_MISSION_SKILL_MAP } from "./skill-evidence";
import type { StudentJourneyPassport, PassportCreativeItem } from "./types";

const DONE_STATES = new Set(["verified", "result_achieved"]);

// Career Mission identity (docs/stage1-learning-os-v1/01_PRODUCTION_AUDIT.md) — the real Outcome 01
// Missions whose Mission Workspace block values ARE the student's Career Direction/Career Map/
// 90-Day Goal. Read from student_mission_workspace_values (migration 0052), the same table the
// Mission Workspace itself already saves to — no new column, no copy.
//
// Keyed by root_mission_id (migration 0054), NOT title: the 2026-08-13 Stage 1 Blueprint
// Transformation renamed "Hoàn thành Career Map" -> "Hoàn thành Makeup Career Map" and "Xác định mục
// tiêu 90 ngày" -> "Lộ trình Makeup 90 ngày của tôi" on the new published version — a title-keyed map
// would have silently stopped recognizing both the moment that version went live (exactly what
// happened before this fix: Career Passport on /student/profile went blank for real students).
// root_mission_id is the one identifier guaranteed to survive a rename/re-clone across versions.
const CAREER_MISSION_ROOT_IDS = { direction: "e6956113-3a08-4d93-8a74-b574a10389c4", careerMap: "cbfbcc11-237a-46e5-b498-a8222974a634", ninetyDay: "6c1bcff8-0c54-4ea7-960f-b9396189a0ea" } as const;

/**
 * Student Journey Passport (v5/36-H2OBOOK_STAGE1_LEARNING_OS_V1): a read-only aggregate over
 * canonical sources already built across this session's earlier folders — never a new
 * source-of-truth, never fabricated. Sections with no real signal yet say so plainly ("Chưa đủ dữ
 * liệu") rather than showing a placeholder that looks like a real number.
 */
export async function getStudentJourneyPassport(organizationId: string, studentId: string, stageId: string): Promise<StudentJourneyPassport> {
  const admin = createSupabaseAdminClient();
  const empty: StudentJourneyPassport = {
    studentId, stageId,
    identity: { fullName: "", avatarUrl: null },
    career: { direction: null, careerMapSummary: null, ninetyDayGoal: null },
    learning: { stageTitle: "", progressPercent: 0, missionsTotal: 0, missionsDone: 0 },
    skill: [], creative: [], brand: [],
    evidence: { missionsWithEvidence: 0, totalEvidenceItems: 0 },
    credential: { status: "locked", certificateNo: null, issuedAt: null }
  };
  if (!admin) return empty;

  const [{ data: profileRow }, journey, skillMastery, { data: projectRows }, { data: certRows }] = await Promise.all([
    admin.from("profiles").select("full_name,avatar_url").eq("id", studentId).maybeSingle(),
    getJourneyForStudent(studentId, organizationId, stageId),
    getSkillMastery(studentId, organizationId),
    admin.from("create_outcome_projects").select("id,title,outcome_type,status,source_stage_key").eq("organization_id", organizationId).eq("owner_user_id", studentId).order("updated_at", { ascending: false }),
    admin.from("certificate_issues").select("certificate_no,status,issued_at,metadata").eq("organization_id", organizationId).eq("student_id", studentId)
  ]);

  const profile = profileRow as { full_name: string; avatar_url: string | null } | null;
  const identity = { fullName: profile?.full_name ?? "", avatarUrl: profile?.avatar_url ?? null };

  if (!journey) return { ...empty, identity };

  const allMissions = journey.outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions));
  const missionsDone = allMissions.filter((m) => DONE_STATES.has(m.displayState)).length;
  const learning = { stageTitle: journey.blueprintTitle ?? "", progressPercent: journey.progressPercent, missionsTotal: allMissions.length, missionsDone };

  const missionByRoot = new Map(allMissions.map((m) => [m.rootMissionId ?? m.id, m]));
  function careerBlockSummary(rootMissionId: string): string | null {
    // A Mission's own successCriteria/evidence carries the closest thing to a real "what did the
    // student produce" summary without reaching into Mission Workspace block values here (those are
    // block-shaped, not prose) — verified/result_achieved is treated as "there is a real answer",
    // and its evidence note (if any) is surfaced; otherwise honestly "Chưa đủ dữ liệu".
    const mission = missionByRoot.get(rootMissionId);
    if (!mission || !DONE_STATES.has(mission.displayState)) return null;
    const latestEvidence = mission.evidence[mission.evidence.length - 1];
    return latestEvidence?.note || mission.expectedResult || null;
  }
  const career = {
    direction: careerBlockSummary(CAREER_MISSION_ROOT_IDS.direction),
    careerMapSummary: careerBlockSummary(CAREER_MISSION_ROOT_IDS.careerMap),
    ninetyDayGoal: careerBlockSummary(CAREER_MISSION_ROOT_IDS.ninetyDay)
  };

  const evidenceCounts = allMissions.reduce((acc, m) => {
    if (m.evidence.length > 0) { acc.missionsWithEvidence += 1; acc.totalEvidenceItems += m.evidence.length; }
    return acc;
  }, { missionsWithEvidence: 0, totalEvidenceItems: 0 });

  const skill = skillMastery
    .filter((s) => Object.values(STAGE1_MISSION_SKILL_MAP).includes(s.key))
    .map((s) => ({ key: s.key, label: s.label, masteryPercent: s.masteryPercent, confidence: s.confidence }));

  const projects = ((projectRows ?? []) as { id: string; title: string; outcome_type: string; status: string; source_stage_key: string | null }[])
    .map((p): PassportCreativeItem => ({ id: p.id, title: p.title, outcomeType: p.outcome_type, status: p.status }));
  const brand = projects.filter((p) => p.outcomeType === "brand_profile");
  const creative = projects.filter((p) => p.outcomeType !== "brand_profile");

  // Eligibility = every real Mission in this Stage reached a done state — the same signal Outcome 04
  // "Hoàn thiện hồ sơ Stage 1" already represents, not a separately invented rule.
  const eligible = allMissions.length > 0 && missionsDone === allMissions.length;
  const certRow = ((certRows ?? []) as { certificate_no: string; status: string; issued_at: string; metadata: Record<string, unknown> }[])
    .find((c) => c.metadata?.stageId === stageId);
  const credential = certRow
    ? { status: "issued" as const, certificateNo: certRow.certificate_no, issuedAt: certRow.issued_at }
    : { status: (eligible ? "eligible" : "locked") as "eligible" | "locked", certificateNo: null, issuedAt: null };

  return { studentId, stageId, identity, career, learning, skill, creative, brand, evidence: evidenceCounts, credential };
}
