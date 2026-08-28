import { NextResponse } from "next/server";
import { resolveTeachingAccess } from "@/lib/teaching/request";
import { listRubrics } from "@/lib/student-competency/service";

const CATEGORIES = new Set(["training", "makeup", "hair"]);

export async function GET(request: Request) {
  const { access, response } = await resolveTeachingAccess(request);
  if (response) return response;
  const categoryParam = new URL(request.url).searchParams.get("category");
  const category = categoryParam && CATEGORIES.has(categoryParam) ? (categoryParam as "training" | "makeup" | "hair") : undefined;
  const rubrics = await listRubrics(access!, category);
  return NextResponse.json({ rubrics });
}
