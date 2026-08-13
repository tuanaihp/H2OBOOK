import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Stage 1 Skill Passport wiring. lib/student/mastery.ts's getSkillMastery() already aggregates
// learning_skill_evidence (migration 0028) into real mastery% — this is the one missing half:
// nothing currently WRITES an evidence row when a real Stage 1 technique Mission completes. Mapped
// by root_mission_id (migration 0054, stable across renames/re-clones — see the 2026-08-13 fix in
// lib/stage1-learning-os/passport.ts/output-reuse.ts for why title-keying broke in production)
// against the real, live Stage 1 curriculum (docs/stage1-learning-os-v1/01_PRODUCTION_AUDIT.md) —
// not invented skill keys, the same catalog lib/student/experience.ts's studentSkills already
// declares.
export const STAGE1_MISSION_SKILL_MAP: Record<string, string> = {
  "586a5f5f-baf6-4412-8e42-2291c58c73be": "skin", // Chuẩn bị da đúng
  "2093b7a6-882f-4082-bcbe-fd5fb3346d81": "skin", // Hoàn thiện lớp nền
  "7e9b353c-b0bd-4067-a054-27444ee6af09": "face", // Màu sắc cơ bản
  "b31064ca-a918-4787-858d-e0edf479d99d": "waves" // Tóc nền tảng
};

/**
 * Score reflects how rigorously this specific completion was actually checked — not an invented
 * number. teacher_verified means a real teacher confirmed it (highest confidence); evidence_required
 * means the student submitted real evidence but no one reviewed it; self_reported/metric_based have
 * no check at all beyond the student's own word, so they score lowest. This mirrors
 * calculateSkillMastery()'s own confidence model (more distinct evidence kinds = more trust).
 */
const SCORE_BY_POLICY: Record<string, number> = {
  teacher_verified: 100,
  evidence_required: 82,
  self_reported: 62,
  metric_based: 62
};

/**
 * Called from the single choke-point (lib/learn-outcome/student.ts's maybeMarkResultAchieved) every
 * completion path funnels through — self-reported, evidence-verified, and teacher-approved all end
 * up here. Uses the admin client deliberately: teacher approval runs under the TEACHER's session, not
 * the student's, so learning_skill_evidence's self-insert RLS policy (`user_id = auth.uid()`) would
 * reject a normal insert — migration 0028's own comment anticipates exactly this ("or in a future
 * pass by a service-role job"). skill_key/score are derived server-side from a fixed map, never
 * accepted as client input, so bypassing RLS here does not open an injection path.
 *
 * No-ops silently for the other 10 Stage 1 Missions (and anything outside Stage 1) — Skill Passport
 * only exists for the 4 real technique Missions the catalog actually has a skill for.
 */
export async function recordStage1SkillEvidence(organizationId: string, studentId: string, missionId: string, completionPolicy: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data } = await admin.from("learning_journey_missions").select("id,root_mission_id").eq("organization_id", organizationId).eq("id", missionId).maybeSingle();
  const row = data as { id: string; root_mission_id: string | null } | null;
  const rootId = row ? (row.root_mission_id ?? row.id) : undefined;
  const skillKey = rootId ? STAGE1_MISSION_SKILL_MAP[rootId] : undefined;
  if (!skillKey) return;
  const score = SCORE_BY_POLICY[completionPolicy] ?? 62;
  await admin.from("learning_skill_evidence").upsert({
    organization_id: organizationId, user_id: studentId, skill_key: skillKey,
    evidence_kind: completionPolicy === "teacher_verified" ? "instructor" : "practice",
    source_type: "learning_journey_missions", source_id: missionId, score
  }, { onConflict: "user_id,skill_key,evidence_kind,source_type,source_id" });
}
