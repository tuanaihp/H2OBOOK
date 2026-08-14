export interface DailyLogInput {
  missionId: string;
  practicedToday: string;
  bestResult?: string;
  problemText?: string;
  suspectedReason?: string;
  nextAction?: string;
  practiceMinutes?: number;
  selfScore?: number;
  assetIds?: string[];
  skillKeys?: string[];
}

export interface DailyLogEntry {
  id: string;
  missionId: string | null;
  journeyDay: number | null;
  practicedToday: string;
  bestResult: string;
  problemText: string;
  suspectedReason: string;
  nextAction: string;
  practiceMinutes: number | null;
  selfScore: number | null;
  instructorScore: number | null;
  instructorFeedback: string | null;
  assetIds: string[];
  skillKeys: string[];
  createdAt: string;
}

export type LearningJourneyResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CapabilitySnapshotType = "weekly" | "day30" | "day60" | "day90";

export interface SkillScoreSummary {
  skillKey: string;
  label: string;
  averageSelfScore: number | null;
  averageInstructorScore: number | null;
  evidenceCount: number;
  trend: "up" | "down" | "flat" | "unknown";
}

export interface RecurringReason { reason: string; count: number }

export interface StudentJourneyContext {
  userId: string;
  journeyDay: number | null;
  totalEntries: number;
  totalPracticeMinutes: number;
  lastPracticedAt: string | null;
  skills: SkillScoreSummary[];
  recurringReasons: RecurringReason[];
  recentNextActions: string[];
  hasEnoughEvidence: boolean;
}

export interface CapabilitySnapshot {
  id: string;
  snapshotType: CapabilitySnapshotType;
  periodStart: string;
  periodEnd: string;
  journeyDay: number | null;
  entriesCount: number;
  practiceMinutesTotal: number;
  skillScores: SkillScoreSummary[];
  recurringReasons: RecurringReason[];
  summary: string;
  hasEnoughEvidence: boolean;
  generatedAt: string;
}
