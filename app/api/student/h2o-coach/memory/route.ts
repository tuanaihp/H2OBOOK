import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { confirmMemoryValue, rejectMemoryValue } from "@/lib/h2o-coach/memory";

type Body = { action?: "confirm" | "reject"; field?: string; value?: unknown };

// Confirmation protocol (docs/INTEGRATION_ARCHITECTURE.md §8): a proposed candidate only becomes
// canonical memory when the learner explicitly confirms it here — AI/offline never writes "confirmed"
// directly for a field marked requiresConfirmation.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return NextResponse.json({ error: "ORG_NOT_CONFIGURED" }, { status: 400 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.field || (body.action !== "confirm" && body.action !== "reject")) return NextResponse.json({ error: "FIELD_AND_ACTION_REQUIRED" }, { status: 400 });

  if (body.action === "confirm") await confirmMemoryValue(organizationId, auth.user!.id, body.field, body.value);
  else await rejectMemoryValue(organizationId, auth.user!.id, body.field);

  return NextResponse.json({ ok: true });
}
