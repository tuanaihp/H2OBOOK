import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { createRubricVersion, listRubrics, type CreateRubricVersionInput } from "@/lib/student-competency/service";

const CATEGORIES = new Set(["training", "makeup", "hair"]);

export async function GET(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const categoryParam = new URL(request.url).searchParams.get("category");
  const category = categoryParam && CATEGORIES.has(categoryParam) ? (categoryParam as "training" | "makeup" | "hair") : undefined;
  const rubrics = await listRubrics(access!, category);
  return NextResponse.json({ rubrics });
}

export async function POST(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Partial<CreateRubricVersionInput> | null;
  if (!body?.category || !CATEGORIES.has(body.category) || !body.title || !Array.isArray(body.criteria)) return NextResponse.json({ error: "INVALID_RUBRIC_PAYLOAD" }, { status: 400 });
  const result = await createRubricVersion(access!, { category: body.category, title: body.title, criteria: body.criteria, quickIssues: body.quickIssues });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "ADMIN_REQUIRED" ? 403 : 400 });
  return NextResponse.json({ ok: true, rubricId: result.rubricId }, { status: 201 });
}
