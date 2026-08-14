import { requireCurrentUser } from "@/lib/auth/current-user";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getUnlockedStageIds, resolveCurrentStageId } from "@/lib/student/stage-access";
import { loadCareerStages } from "@/lib/career-stages/service";
import { getSmartJourneyReadModel } from "@/lib/smart-journey/student";
import { getGrowthRecommendations } from "@/lib/growth/recommendations";
import { emitDomainEvent } from "@/lib/domain/events";
import { SmartJourneyShell } from "@/components/student/smart-journey/smart-journey-shell";
import { GrowthRecommendations } from "@/components/student/growth/growth-recommendations";
import { Compass } from "lucide-react";

export const dynamic = "force-dynamic";

// "Hành trình của tôi" (LEARN tab 1) — the Smart Journey Shell (docs/smart-journey-v3): one read
// model, one shell, Map/Roadmap/Danh sách/Today as views inside it rather than three separate
// pages. Route kept as /student/courses so the sidebar link and every existing deep link keep
// working. "Khóa học bổ trợ" (a flat list of every course, access or not) has been replaced by
// H2O Growth Recommendations (v5/32-.../CLAUDE_INTEGRATION_PROMPT.md §8) — rules-first, reusing
// the real products/academy_courses/entitlements tables instead of a static catalog.
export default async function StudentCoursesPage() {
  const user = await requireCurrentUser();

  if (user.demo) return <JourneyUnavailable message="Chế độ demo chưa có dữ liệu hành trình thật." />;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return <JourneyUnavailable message="Tổ chức chưa được cấu hình." />;

  const [stages, unlockedStageIds] = await Promise.all([loadCareerStages(organizationId), getUnlockedStageIds(user.id, organizationId)]);
  const orderedStages = [...stages].sort((a, b) => a.position - b.position);
  const currentStageId = await resolveCurrentStageId(organizationId, orderedStages, unlockedStageIds);
  const currentStage = orderedStages.find((s) => s.id === currentStageId) ?? orderedStages[0] ?? null;

  const growthItems = await getGrowthRecommendations(user.id, organizationId, user.role);

  if (!currentStage) return <JourneyUnavailable message="Chưa có giai đoạn nào được mở." growthItems={growthItems} />;

  const model = await getSmartJourneyReadModel(user.id, organizationId, currentStage.id);
  if (!model) return <JourneyUnavailable message="Giai đoạn này đang được xây dựng hành trình." growthItems={growthItems} />;

  void emitDomainEvent({ organizationId, actorId: user.id, resourceType: "learning_journey_versions", resourceId: model.journeyVersionId, eventName: "journey.viewed", payload: { stageId: currentStage.id } }).catch(() => {});

  return <>
    <SmartJourneyShell model={model} />
    <GrowthRecommendations items={growthItems} />
  </>;
}

function JourneyUnavailable({ message, growthItems }: { message: string; growthItems?: Awaited<ReturnType<typeof getGrowthRecommendations>> }) {
  return <>
    <section className="h2o-student-page-head"><div><span>H2O NEURAL JOURNEY</span><h1>Hành trình của tôi</h1></div></section>
    <section className="h2o-sr-panel" style={{ padding: 28, textAlign: "center", marginBottom: 24 }}>
      <Compass size={22} style={{ opacity: 0.5 }} />
      <p style={{ marginTop: 8, fontSize: 13 }}>{message}</p>
    </section>
    {growthItems && <GrowthRecommendations items={growthItems} />}
  </>;
}
