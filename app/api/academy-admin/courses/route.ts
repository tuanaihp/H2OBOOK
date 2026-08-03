import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { createCourse, listCourses, type CreateCourseInput } from "@/lib/academy-admin/courses";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const courses = await listCourses(access!);
  return NextResponse.json({ courses });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Partial<CreateCourseInput> | null;
  if (!body?.title?.trim()) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  const result = await createCourse(access!, { title: body.title, category: body.category, level: body.level, description: body.description });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
