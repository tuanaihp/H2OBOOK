import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { commitInputSession } from "@/lib/input/orchestrator-server";
import type { InputCorrection, InputDestinationConfig } from "@h2obook/input-core";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";
import { readJsonBody } from "@/lib/security/request-limits";
import { inputErrorResponse } from "@/lib/input/api-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const limited = await rateLimit(requestIdentity(request, "input-session-commit"), 20, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const body = await readJsonBody<{ organizationId?: string; corrections?: InputCorrection[]; destination?: InputDestinationConfig }>(request, 6 * 1024 * 1024);
    const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, ["owner", "admin", "designer"]);
    if (!access) throw new Error("WORKSPACE_FORBIDDEN");
    const { id } = await params;
    const result = await commitInputSession({ organizationId: access.organizationId, userId: auth.user!.id, sessionId: id, corrections: body?.corrections, destination: body?.destination });
    return NextResponse.json({ result });
  } catch (error) { return inputErrorResponse(error, request, "INPUT_COMMIT_FAILED", { recoveryRequired: true }); }
}
