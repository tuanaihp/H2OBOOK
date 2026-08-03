import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { buildTeachingCommandCenter } from "@/lib/teaching/command-center";

export async function GET(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const summary = await buildTeachingCommandCenter(access!);
  return NextResponse.json({ ...summary, organizationId: access!.organizationId, role: access!.role });
}
