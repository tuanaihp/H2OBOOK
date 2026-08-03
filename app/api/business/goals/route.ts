import { NextResponse } from "next/server";
import { resolveBusinessAccess } from "@/lib/business/request";
import { createGoal, getMyGoals, type CreateGoalInput } from "@/lib/business/goals";

export async function GET(request: Request) {
  const { access, response } = await resolveBusinessAccess(request);
  if (response) return response;
  const goals = await getMyGoals(access!);
  return NextResponse.json({ goals });
}

export async function POST(request: Request) {
  const { access, response } = await resolveBusinessAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Partial<CreateGoalInput> | null;
  if (!body?.title?.trim() || !body.unit || !body.targetValue || body.targetValue <= 0) {
    return NextResponse.json({ error: "TITLE_UNIT_TARGET_REQUIRED" }, { status: 400 });
  }
  const result = await createGoal(access!, { title: body.title, unit: body.unit, targetValue: body.targetValue, dueAt: body.dueAt });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
