import { NextResponse } from "next/server";
import { resolveBusinessAccess } from "@/lib/business/request";
import { updateOpportunity, type UpsertOpportunityInput } from "@/lib/business/opportunities";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveBusinessAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as Partial<UpsertOpportunityInput> | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  const result = await updateOpportunity(access!, id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "OPPORTUNITY_NOT_FOUND" ? 404 : 400 });
  return NextResponse.json(result);
}
