// Stage 1 Learning OS V1 — types for the Student Journey Passport aggregate read-model and the two
// Mission Workspace inserts (Known Context / Output Reuse). See docs/stage1-learning-os-v1/
// 01_PRODUCTION_AUDIT.md: everything here aggregates existing canonical tables, nothing is a new
// source-of-truth.

export interface KnownFact { label: string; value: string; sourceMissionId: string | null; sourceMissionTitle: string | null }
export interface MissionContextSnapshot { knownFacts: KnownFact[] }

export interface OutputDestination { label: string; surface: "journey" | "library" | "create" | "business" | "profile" | "credential"; destinationKey: string }

export interface PassportIdentity { fullName: string; avatarUrl: string | null }
export interface PassportCareer { direction: string | null; careerMapSummary: string | null; ninetyDayGoal: string | null }
export interface PassportLearning { stageTitle: string; progressPercent: number; missionsTotal: number; missionsDone: number }
export interface PassportSkillSummary { key: string; label: string; masteryPercent: number; confidence: "low" | "medium" | "high" }
export interface PassportCreativeItem { id: string; title: string; outcomeType: string; status: string }
export interface PassportEvidence { missionsWithEvidence: number; totalEvidenceItems: number }
export interface PassportCredential { status: "locked" | "eligible" | "issued"; certificateNo: string | null; issuedAt: string | null }

export interface StudentJourneyPassport {
  studentId: string; stageId: string;
  identity: PassportIdentity;
  career: PassportCareer;
  learning: PassportLearning;
  skill: PassportSkillSummary[];
  creative: PassportCreativeItem[];
  brand: PassportCreativeItem[];
  evidence: PassportEvidence;
  credential: PassportCredential;
}
