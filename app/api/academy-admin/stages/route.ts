import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { createStage, listStagesForAdmin, seedDefaultStages } from "@/lib/career-stages/admin";
import { isStageStatus } from "@/lib/career-stages/types";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  return NextResponse.json({ stages: await listStagesForAdmin(access!) });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  // One endpoint, two intents: seeding the shipped five, or creating a single stage. Seeding is
  // opt-in and refuses when any stage already exists, so it can never clobber real edits.
  if (body?.action === "seed") {
    const seeded = await seedDefaultStages(access!);
    if (!seeded.ok) return NextResponse.json({ error: seeded.error }, { status: 400 });
    return NextResponse.json(seeded.data, { status: 201 });
  }

  const title = typeof body?.title === "string" ? body.title : "";
  if (!title.trim()) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  const created = await createStage(access!, {
    slug: typeof body?.slug === "string" ? body.slug : "",
    title,
    indexLabel: typeof body?.indexLabel === "string" ? body.indexLabel : undefined,
    subtitle: typeof body?.subtitle === "string" ? body.subtitle : undefined,
    description: typeof body?.description === "string" ? body.description : undefined,
    durationLabel: typeof body?.durationLabel === "string" ? body.durationLabel : undefined,
    skills: Array.isArray(body?.skills) ? body.skills.map(String) : undefined,
    status: isStageStatus(body?.status) ? body.status : undefined
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });
  return NextResponse.json(created.data, { status: 201 });
}
