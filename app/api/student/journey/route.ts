import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getUnlockedStageIds, resolveCurrentStageId } from "@/lib/student/stage-access";
import { loadCareerStages } from "@/lib/career-stages/service";
import { getJourneyForStudent } from "@/lib/learn-outcome/student";

// The student's Journey Map for their current stage — the highest-position stage they have
// unlocked, matching "current stage" everywhere else in the app (Smart Home, roadmap). Demo mode
// and unconfigured organizations return an explicit empty payload, never a fabricated journey.
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ mode: "demo", stage: null, journey: null });

  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ mode: "unconfigured", stage: null, journey: null });

  const [stages, unlockedStageIds] = await Promise.all([
    loadCareerStages(organizationId),
    getUnlockedStageIds(auth.user!.id, organizationId)
  ]);
  const orderedStages = [...stages].sort((a, b) => a.position - b.position);
  const currentStageId = await resolveCurrentStageId(organizationId, orderedStages, unlockedStageIds);
  const currentStage = orderedStages.find((s) => s.id === currentStageId) ?? orderedStages[0] ?? null;
  if (!currentStage) return NextResponse.json({ mode: "production", stage: null, journey: null });

  const journey = await getJourneyForStudent(auth.user!.id, organizationId, currentStage.id);
  return NextResponse.json({
    mode: "production",
    stage: { id: currentStage.id, title: currentStage.title, indexLabel: currentStage.indexLabel },
    journey
  });
}
