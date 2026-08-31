import { SKILL_CATALOG, type CompetencySkillPoint } from "./types";

// Pure aggregation over learning_skill_evidence rows already scoped to one student (fetched by
// the caller — same "assemble server-side, score in pure functions" split as
// lib/student/mastery.ts's getSkillMastery/calculateSkillMastery). Kept Supabase-free for unit
// testing and reuse in the competency API route.
export interface SkillEvidenceRow {
  skillKey: string;
  score: number;
  occurredAt: string;
}

function avgWithinWindow(rows: SkillEvidenceRow[], days: number, now: number): number | null {
  const cutoff = now - days * 86_400_000;
  const inWindow = rows.filter((row) => new Date(row.occurredAt).getTime() >= cutoff);
  if (!inWindow.length) return null;
  return Math.round(inWindow.reduce((sum, row) => sum + row.score, 0) / inWindow.length);
}

export function aggregateCompetencyProfile(evidence: SkillEvidenceRow[], now: number = Date.now()): CompetencySkillPoint[] {
  const bySkill = new Map<string, SkillEvidenceRow[]>();
  for (const row of evidence) {
    const list = bySkill.get(row.skillKey) ?? [];
    list.push(row);
    bySkill.set(row.skillKey, list);
  }

  return SKILL_CATALOG.map((skill) => {
    const rows = (bySkill.get(skill.key) ?? []).sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    const latest = rows.length ? rows[rows.length - 1].score : null;
    return {
      key: skill.key,
      label: skill.label,
      latestScore: latest,
      trend30: avgWithinWindow(rows, 30, now),
      trend60: avgWithinWindow(rows, 60, now),
      trend90: avgWithinWindow(rows, 90, now),
      evidenceCount: rows.length,
      weakEvidenceCount: rows.filter((row) => row.score < 70).length
    };
  });
}

// Spec §G: "mức sẵn sàng nhận khách" (client-readiness) — a simple, explainable readout derived
// from the same aggregated profile rather than a separate stored flag, so it can never drift from
// the scores it summarizes.
export function estimateClientReadiness(profile: CompetencySkillPoint[]): "san_sang" | "gan_san_sang" | "can_luyen_them" {
  const scored = profile.filter((skill) => skill.latestScore != null);
  if (!scored.length) return "can_luyen_them";
  const avg = scored.reduce((sum, skill) => sum + (skill.latestScore ?? 0), 0) / scored.length;
  const weakCount = scored.filter((skill) => (skill.latestScore ?? 0) < 70).length;
  if (avg >= 85 && weakCount === 0) return "san_sang";
  if (avg >= 70 && weakCount <= 2) return "gan_san_sang";
  return "can_luyen_them";
}
