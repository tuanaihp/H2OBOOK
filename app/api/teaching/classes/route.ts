import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { getTeachingClasses } from "@/lib/teaching/classes";

export async function GET(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const classes = await getTeachingClasses(access!);
  return NextResponse.json({ classes, organizationId: access!.organizationId });
}
