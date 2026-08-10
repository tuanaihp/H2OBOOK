import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { loadCareerStages } from "@/lib/career-stages/service";
import { getUnlockedStageIds } from "@/lib/student/stage-access";
import { factsForResource, loadStudentAccessContext } from "@/lib/content-access/facts";
import { resolveResourceAccess } from "@/lib/content-access/resolver";

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

  const [unlocked, accessContext] = await Promise.all([
    getUnlockedStageIds(user.id, organizationId),
    loadStudentAccessContext(user.id, organizationId)
  ]);

  const payload = stages.map((stage) => {
    // A stage counts as unlocked when the unlock set names it — both keyed by real career_stages.slug
    // (lib/student/stage-access.ts): first stage free, every stage once membership is active, or an
    // explicit manual grant.
    const stageUnlocked = unlocked.has(stage.slug);
    return {
      slug: stage.slug,
      title: stage.title,
      indexLabel: stage.indexLabel,
      durationLabel: stage.durationLabel,
      unlocked: stageUnlocked,
      // Every resource now goes through the one resolver rather than a local rule, so the library
      // agrees with the reader guard and with every other surface by construction.
      resources: stage.resources
        .map((resource) => ({ resource, decision: accessContext ? resolveResourceAccess(factsForResource(accessContext, resource)) : null }))
        .filter(({ decision }) => decision?.access === "granted")
        .map(({ resource, decision }) => ({
          id: resource.id,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          title: resource.title,
          summary: resource.summary,
          href: resource.href,
          free: decision!.source === "free",
          expiresAt: decision!.expiresAt
        })),
      lockedCount: stage.resources.filter((resource) => {
        const decision = accessContext ? resolveResourceAccess(factsForResource(accessContext, resource)) : null;
        return decision?.access !== "granted";
      }).length
    };
  });

  return NextResponse.json({ mode: "production", stages: payload });
}
