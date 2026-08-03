import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { getCourseDetail, updateCourse, type UpdateCourseInput } from "@/lib/academy-admin/courses";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const course = await getCourseDetail(access!, id);
  if (!course) return NextResponse.json({ error: "COURSE_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ course });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as UpdateCourseInput | null;
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  const result = await updateCourse(access!, id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
