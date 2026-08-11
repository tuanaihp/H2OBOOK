import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { resolveOrganizationAccess } from "@/lib/auth/api";
import { getLearningControlSummary } from "@/lib/learning-control/summary";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const requestedId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const access = await resolveOrganizationAccess(auth.user!, requestedId, ["owner", "admin", "teacher"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const summary = await getLearningControlSummary(access.organizationId);
  return NextResponse.json({ summary });
}
