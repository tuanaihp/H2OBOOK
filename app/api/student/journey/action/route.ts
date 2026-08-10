import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { updateActionStatus } from "@/lib/learn-outcome/student";

type Body = { actionId?: string; status?: "planned" | "doing" | "completed" | "skipped" };

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.actionId || !body?.status) return NextResponse.json({ error: "ACTION_AND_STATUS_REQUIRED" }, { status: 400 });
  const result = await updateActionStatus(auth.user!.id, body.actionId, body.status);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
