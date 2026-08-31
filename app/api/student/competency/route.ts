import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getOwnStudentCompetency } from "@/lib/student-competency/service";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ classes: [], mode: "demo" });
  const classes = await getOwnStudentCompetency(auth.user!.id);
  return NextResponse.json({ classes, mode: "production" });
}
