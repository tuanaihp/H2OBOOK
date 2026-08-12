import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getJourneyForStudent } from "@/lib/learn-outcome/student";
import type { KnownFact, MissionContextSnapshot } from "./types";

const DONE_STATES = new Set(["verified", "result_achieved"]);

/**
 * "H2O đã biết gì về bạn?" (docs/stage1-learning-os-v1 §Mission Workspace). Real facts only: every
 * Mission earlier in the SAME Chặng that the student has already completed contributes one fact —
 * its own real evidence note if one was submitted, otherwise its expected result. No invented field
 * names (target customer/strength etc. from the source blueprint don't exist as real data on this
 * curriculum's Missions) — this generalizes to "what has this student already produced that a later
 * step in the same Chặng could reasonably build on", true for any Mission, not specific content.
 *
 * Scoped to same-Chặng, earlier `position` (the real field the Journey Tree Editor reorders by,
 * docs/journey-tree-editor-v1 — so this stays correct after any admin reorder) — matches the source
 * package's own example ("Mission 2 đọc Mission 1"), and keeps the list short and relevant rather
 * than dumping every prior Mission in the whole Stage.
 */
export async function getMissionContextSnapshot(organizationId: string, studentId: string, missionId: string): Promise<MissionContextSnapshot> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { knownFacts: [] };

  const missionRow = await admin.from("learning_journey_missions").select("id,milestone_id,position").eq("organization_id", organizationId).eq("id", missionId).maybeSingle();
  if (!missionRow.data) return { knownFacts: [] };
  const { milestone_id: milestoneId, position: currentPosition } = missionRow.data as { milestone_id: string; position: number };

  const milestoneRow = await admin.from("learning_journey_milestones").select("outcome_id").eq("organization_id", organizationId).eq("id", milestoneId).maybeSingle();
  if (!milestoneRow.data) return { knownFacts: [] };
  const outcomeRow = await admin.from("learning_journey_outcomes").select("version_id").eq("organization_id", organizationId).eq("id", (milestoneRow.data as { outcome_id: string }).outcome_id).maybeSingle();
  if (!outcomeRow.data) return { knownFacts: [] };
  const versionRow = await admin.from("learning_journey_versions").select("blueprint_id").eq("organization_id", organizationId).eq("id", (outcomeRow.data as { version_id: string }).version_id).maybeSingle();
  if (!versionRow.data) return { knownFacts: [] };
  const blueprintRow = await admin.from("learning_journey_blueprints").select("stage_id").eq("organization_id", organizationId).eq("id", (versionRow.data as { blueprint_id: string }).blueprint_id).maybeSingle();
  const stageId = (blueprintRow.data as { stage_id: string } | null)?.stage_id;
  if (!stageId) return { knownFacts: [] };

  const journey = await getJourneyForStudent(studentId, organizationId, stageId);
  if (!journey) return { knownFacts: [] };

  const milestone = journey.outcomes.flatMap((o) => o.milestones).find((m) => m.id === milestoneId);
  if (!milestone) return { knownFacts: [] };

  const knownFacts: KnownFact[] = milestone.missions
    .filter((m) => m.position < currentPosition && DONE_STATES.has(m.displayState))
    .map((m): KnownFact => {
      const latestEvidence = m.evidence[m.evidence.length - 1];
      return { label: m.title, value: latestEvidence?.note || m.expectedResult || "Đã hoàn thành", sourceMissionId: m.id, sourceMissionTitle: m.title };
    });

  return { knownFacts };
}
