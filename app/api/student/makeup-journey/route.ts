import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getOwnClassJourney } from "@/lib/student-competency/service";

// The student's own view of their Makeup 60-session course (schedule, evidence, grades). Scope is
// exactly one verified class membership resolved inside getOwnClassJourney — this route never
// trusts a class id from the client.
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.user!.demo) return NextResponse.json({ mode: "demo", journey: null });
  const journey = await getOwnClassJourney(auth.user!.id);
  return NextResponse.json({ mode: "production", journey });
}
