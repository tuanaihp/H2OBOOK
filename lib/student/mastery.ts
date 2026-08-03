import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { studentSkills } from "@/lib/student/experience";

// Skill Mastery (H2OBOOK Learn Mastery Engine V1, adapted from
// v5/11-h2obook-learn-mastery-engine-v1/src/core/mastery.ts). Pure scoring functions are ported
// as-is; the "evidence" they score is assembled server-side in getSkillMastery() from two real
// sources — see migration 0028's header comment for why no evidence-ledger backfill was needed
// for lesson completions specifically.

export type EvidenceKind = "lesson" | "review" | "quiz" | "practice" | "instructor" | "create";
export interface SkillEvidence { kind: EvidenceKind; score: number; weight?: number }
export interface SkillMastery { key: string; label: string; masteryPercent: number; confidence: "low" | "medium" | "high"; evidenceCount: number; nextAction?: string }

const DEFAULT_WEIGHTS: Record<EvidenceKind, number> = { lesson: 0.12, review: 0.15, quiz: 0.18, practice: 0.28, instructor: 0.17, create: 0.1 };

function clamp(value: number, min = 0, max = 100) { return Math.min(max, Math.max(min, value)); }

export function calculateSkillMastery(key: string, label: string, evidence: SkillEvidence[]): SkillMastery {
  if (evidence.length === 0) return { key, label, masteryPercent: 0, confidence: "low", evidenceCount: 0, nextAction: "Hoàn thành bài học đầu tiên để bắt đầu đo năng lực." };
  let weightedScore = 0;
  let totalWeight = 0;
  for (const item of evidence) {
    const weight = item.weight ?? DEFAULT_WEIGHTS[item.kind];
    weightedScore += clamp(item.score) * weight;
    totalWeight += weight;
  }
  const masteryPercent = Math.round(clamp(weightedScore / Math.max(totalWeight, 0.001)));
  const distinctKinds = new Set(evidence.map((item) => item.kind)).size;
  const confidence: SkillMastery["confidence"] = distinctKinds >= 4 && evidence.length >= 5 ? "high" : distinctKinds >= 2 ? "medium" : "low";
  let nextAction: string;
  if (masteryPercent < 45) nextAction = "Xem lại bài cốt lõi và hoàn thành một bài thực hành có hướng dẫn.";
  else if (masteryPercent < 70) nextAction = "Ôn flashcard đến hạn và nộp thêm một bằng chứng thực hành.";
  else if (masteryPercent < 85) nextAction = "Tạo một thành quả trong Create để củng cố năng lực.";
  else nextAction = "Sẵn sàng nhận bài nâng cao hoặc chuyển sang kỹ năng kế tiếp.";
  return { key, label, masteryPercent, confidence, evidenceCount: evidence.length, nextAction };
}

export function calculateOverallMastery(skills: SkillMastery[]): number {
  if (skills.length === 0) return 0;
  return Math.round(skills.reduce((sum, skill) => sum + skill.masteryPercent, 0) / skills.length);
}

/**
 * Merges academy_skill_progress (existing "lesson" signal, 0024) with learning_skill_evidence
 * (new ledger, 0028, currently written to by the Create Outcome share flow — see
 * app/api/create/projects/[id]/share/route.ts) into per-skill SkillMastery for one learner.
 */
export async function getSkillMastery(userId: string, organizationId: string): Promise<SkillMastery[]> {
  if (!isSupabaseConfigured()) return [];
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const [{ data: lessonRows }, { data: evidenceRows }] = await Promise.all([
    admin.from("academy_skill_progress").select("skill_key,progress_percent,evidence_count").eq("user_id", userId),
    admin.from("learning_skill_evidence").select("skill_key,evidence_kind,score,weight").eq("user_id", userId).eq("organization_id", organizationId)
  ]);

  const bySkill = new Map<string, SkillEvidence[]>();
  for (const row of lessonRows ?? []) {
    const key = String(row.skill_key);
    const count = Math.max(1, Number(row.evidence_count ?? 1));
    const list = bySkill.get(key) ?? [];
    // One synthetic "lesson" evidence entry per skill, weighted up by how many lessons fed it,
    // rather than exploding into N rows — keeps this proportional without needing a backfill.
    list.push({ kind: "lesson", score: Number(row.progress_percent ?? 0), weight: DEFAULT_WEIGHTS.lesson * Math.min(count, 5) });
    bySkill.set(key, list);
  }
  for (const row of evidenceRows ?? []) {
    const key = String(row.skill_key);
    const list = bySkill.get(key) ?? [];
    list.push({ kind: row.evidence_kind as EvidenceKind, score: Number(row.score ?? 0), weight: row.weight != null ? Number(row.weight) : undefined });
    bySkill.set(key, list);
  }

  return studentSkills.map((skill) => calculateSkillMastery(skill.id, skill.title, bySkill.get(skill.id) ?? []));
}
