import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getMissionWorkspaceView } from "@/lib/mission-workspace/student";
import { MissionWorkspaceClient } from "@/components/student/mission-workspace/mission-workspace-client";
import { CoachWorkspaceShell, type CoachJourneyItem } from "@/components/h2o-coach/coach-workspace-shell";
import { h2oCoachFeatures } from "@/lib/h2o-coach/feature-flags";
import { getCoachSessionState } from "@/lib/h2o-coach/service";

export const dynamic = "force-dynamic";

// Universal Mission Workspace — "Smart Roadmap → click Mission → Workspace → Result → back to
// Roadmap" (docs/smart-learning Release 2, v5/30-.../CLAUDE_INTEGRATION_PROMPT.md §2/§5). The read
// model (lib/mission-workspace/student.ts) walks the same published-version graph the Roadmap uses,
// so a Draft-only or another org's Mission id simply 404s here — there is no second lookup path
// that could leak it.
export default async function StudentMissionWorkspacePage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const user = await requireCurrentUser();
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId || user.demo) notFound();

  const view = await getMissionWorkspaceView(user.id, organizationId, missionId);
  if (!view) return <section className="h2o-student-section" style={{ maxWidth: 560 }}>
    <h1 style={{ fontSize: 19 }}>Không tìm thấy Mission</h1>
    <p style={{ color: "#718092", fontSize: 13, lineHeight: 1.7 }}>Mission này không tồn tại, chưa được publish, hoặc không thuộc hành trình của bạn.</p>
    <Link href="/student/courses" style={{ fontSize: 13 }}>← Về Roadmap</Link>
  </section>;

  // H2O Coach OS V1 (docs/h2o-coach-v1) — mounted only when the flag is on AND this Stage/Mission
  // actually has a published Coach profile + coaching config. No profile configured (the common case
  // until an admin publishes one) means getCoachSessionState returns null and the 4-tab Mission
  // Workspace below is unaffected — this never replaces it silently.
  const coachSession = h2oCoachFeatures.coachWorkspaceV1 ? await getCoachSessionState(organizationId, user.id, missionId) : null;
  if (coachSession) {
    const journeyItems: CoachJourneyItem[] = view.siblings.map((s) => ({
      id: s.id, title: s.title,
      state: s.displayState === "locked" ? "locked" : s.displayState === "result_achieved" ? "done" : s.id === missionId ? "current" : "available"
    }));
    return <CoachWorkspaceShell
      missionId={missionId} stageTitle={view.stage.title} missionTitle={view.mission.title}
      initialProgressPercent={coachSession.progressPercent} initialMissionState={coachSession.missionState} journeyItems={journeyItems}
      resources={view.mission.resourceBindings.map((r) => ({ id: r.id, title: r.title, resourceType: r.resourceType, resourceId: r.resourceId }))}
      memorySchema={coachSession.profile.memorySchema.map((f) => ({ key: f.key, label: f.label, namespace: f.namespace }))}
      initialMemory={coachSession.memory.map((m) => ({ field: m.field, namespace: m.namespace, value: m.value, status: m.status, updatedAt: m.updatedAt }))}
      initialMessages={coachSession.messages}
    />;
  }

  return <MissionWorkspaceClient missionId={missionId} initialView={view} />;
}
