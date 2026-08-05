import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { loadCareerStages } from "@/lib/career-stages/service";
import { getUnlockedStageIds } from "@/lib/student/stage-access";

// What the student may actually see in their library, decided server-side from three real inputs:
// the curriculum map (career_stage_resources), which stages this student has unlocked
// (lib/student/stage-access.ts), and each resource's own access setting. Returns mode:"demo" when
// the curriculum has not been configured yet, so the page can say so plainly instead of quietly
// showing seed data — which is exactly how the old demo-store library went unnoticed.
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const user = await getCurrentUser();
  const organizationId = await configuredAcademyOrganizationId();
  if (!user || user.demo || !organizationId) return NextResponse.json({ mode: "demo", stages: [] });

  const stages = await loadCareerStages(organizationId);
  if (stages.length === 0) return NextResponse.json({ mode: "unconfigured", stages: [] });

  const unlocked = await getUnlockedStageIds(user.id, organizationId);

  const payload = stages.map((stage) => {
    // A stage counts as unlocked when the unlock set names it. That set is keyed by the ids in
    // lib/student/experience.ts, so a stage whose slug matches one of those lines up automatically;
    // any stage added later is locked until it is wired into the unlock rules or granted directly.
    const stageUnlocked = unlocked.has(stage.slug);
    return {
      slug: stage.slug,
      title: stage.title,
      indexLabel: stage.indexLabel,
      durationLabel: stage.durationLabel,
      unlocked: stageUnlocked,
      resources: stage.resources
        .filter((resource) => resource.access === "free_preview" || stageUnlocked)
        .map((resource) => ({
          id: resource.id,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          title: resource.title,
          summary: resource.summary,
          href: resource.href,
          free: resource.access === "free_preview"
        })),
      lockedCount: stage.resources.filter((resource) => resource.access !== "free_preview" && !stageUnlocked).length
    };
  });

  return NextResponse.json({ mode: "production", stages: payload });
}
