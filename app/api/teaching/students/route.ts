import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { getAssignedStudentSummaries } from "@/lib/teaching/students";

export async function GET(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const students = await getAssignedStudentSummaries(access!);
  return NextResponse.json({ students, organizationId: access!.organizationId });
}
