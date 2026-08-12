import "server-only";
import { loadCareerStages } from "@/lib/career-stages/service";
import { stageDisplayRank } from "@/lib/career-stages/types";

/** Resolves "Stage 1" — the real, rank-1 active Stage (docs/stage1-learning-os-v1) — never hardcoded by id/slug, since those differ per organization/seed. */
export async function resolveStage1Id(organizationId: string): Promise<string | null> {
  const stages = await loadCareerStages(organizationId);
  const rankOne = stages.find((s) => stageDisplayRank(stages, s.id) === 1);
  return rankOne?.id ?? null;
}
