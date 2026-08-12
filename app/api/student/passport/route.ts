import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { resolveStage1Id } from "@/lib/stage1-learning-os/stage";
import { getStudentJourneyPassport } from "@/lib/stage1-learning-os/passport";

// Student Journey Passport (docs/stage1-learning-os-v1) — one aggregate read of real canonical
// sources, self-scoped: the caller is always auth.user's own id, never a studentId from the client.
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ mode: "demo", passport: null });
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ mode: "unconfigured", passport: null });
  const stageId = await resolveStage1Id(organizationId);
  if (!stageId) return NextResponse.json({ mode: "unconfigured", passport: null });
  const passport = await getStudentJourneyPassport(organizationId, auth.user!.id, stageId);
  return NextResponse.json({ mode: "production", passport });
}
