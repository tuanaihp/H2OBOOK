import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { findStudentByEmail } from "@/lib/academy-admin/entitlements";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const email = new URL(request.url).searchParams.get("email")?.trim();
  if (!email) return NextResponse.json({ error: "EMAIL_REQUIRED" }, { status: 400 });
  const student = await findStudentByEmail(access!, email);
  if (!student) return NextResponse.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ student });
}
