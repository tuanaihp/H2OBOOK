import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { buildStudentJourneyContext } from "@/lib/learning-journey/student-context";

// Deterministic H2OBrain context for the CURRENT student's own account only — scoped to self, same
// as every other /api/student/* read route. No AI call happens here; this returns real aggregated
// numbers for an AI mentor to interpret, never numbers an AI invents (see
// lib/learning-journey/student-context.ts's header comment).
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const context = await buildStudentJourneyContext(organizationId, auth.user!.id);
  return NextResponse.json({ context });
}
