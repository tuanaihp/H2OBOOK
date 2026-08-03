import { NextResponse } from "next/server";
import { resolveBusinessAccess } from "@/lib/business/request";
import { createOpportunity, getMyOpportunities, type UpsertOpportunityInput } from "@/lib/business/opportunities";

export async function GET(request: Request) {
  const { access, response } = await resolveBusinessAccess(request);
  if (response) return response;
  const opportunities = await getMyOpportunities(access!);
  return NextResponse.json({ opportunities });
}

export async function POST(request: Request) {
  const { access, response } = await resolveBusinessAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Partial<UpsertOpportunityInput> | null;
  if (!body?.customerName?.trim() || !body?.serviceName?.trim()) {
    return NextResponse.json({ error: "CUSTOMER_AND_SERVICE_REQUIRED" }, { status: 400 });
  }
  const result = await createOpportunity(access!, {
    customerName: body.customerName,
    serviceName: body.serviceName,
    estimatedValue: body.estimatedValue ?? 0,
    status: body.status,
    source: body.source,
    nextActionAt: body.nextActionAt,
    notes: body.notes,
    customerContact: body.customerContact,
    createAssetProjectId: body.createAssetProjectId
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
