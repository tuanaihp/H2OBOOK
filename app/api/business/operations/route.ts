import { NextResponse } from "next/server";
import { resolveBusinessAccess } from "@/lib/business/request";
import { getMyCommerceOverview } from "@/lib/business/operations";

export async function GET(request: Request) {
  const { access, response } = await resolveBusinessAccess(request);
  if (response) return response;
  const overview = await getMyCommerceOverview(access!);
  return NextResponse.json(overview);
}
