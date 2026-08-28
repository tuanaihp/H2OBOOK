import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { getClassRoster } from "@/lib/student-competency/service";

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const { classId } = await params;
  const roster = await getClassRoster(access!, classId);
  if (roster === null) return NextResponse.json({ error: "FORBIDDEN_CLASS_SCOPE" }, { status: 403 });
  return NextResponse.json({ roster });
}
