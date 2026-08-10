import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getMissionWorkspaceView } from "@/lib/mission-workspace/student";
import { MissionWorkspaceClient } from "@/components/student/mission-workspace/mission-workspace-client";

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

  return <MissionWorkspaceClient missionId={missionId} initialView={view} />;
}
