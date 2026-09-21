import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { createTeachingClass, getTeachingClasses } from "@/lib/teaching/classes";

export async function GET(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const classes = await getTeachingClasses(access!);
  return NextResponse.json({ classes, organizationId: access!.organizationId });
}

export async function POST(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as { name?: string; code?: string; totalSessions?: number; startDate?: string; endDate?: string; color?: string; status?: string; bookIds?: string[] } | null;
  if (!body?.name) return NextResponse.json({ error: "CLASS_NAME_AND_CODE_REQUIRED" }, { status: 400 });
  const result = await createTeachingClass(access!, {
    name: body.name,
    code: body.code,
    totalSessions: body.totalSessions,
    startDate: body.startDate,
    endDate: body.endDate,
    color: body.color,
    status: body.status,
    bookIds: Array.isArray(body.bookIds) ? body.bookIds.map(String) : undefined
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "CLASS_CODE_ALREADY_EXISTS" ? 409 : 400 });
  return NextResponse.json({ ok: true, class: result.klass }, { status: 201 });
}
