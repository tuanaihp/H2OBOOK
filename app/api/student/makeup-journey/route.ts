import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getOwnClassJourney } from "@/lib/student-competency/service";
import { describeAiProvider } from "@/lib/h2obook/ai/adapter";

// The student's own view of their Makeup 60-session course (schedule, evidence, grades). Scope is
// exactly one verified class membership resolved inside getOwnClassJourney — this route never
// trusts a class id from the client. `ai` only describes which pre-check engine is wired (never a
// key) so the Learning Copilot panel can label itself "offline / rubric" vs "AI nâng cao".
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const ai = describeAiProvider();
  if (auth.user!.demo) return NextResponse.json({ mode: "demo", journey: null, ai });
  const journey = await getOwnClassJourney(auth.user!.id);
  return NextResponse.json({ mode: "production", journey, ai });
}
