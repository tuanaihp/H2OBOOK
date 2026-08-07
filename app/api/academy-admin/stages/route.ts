import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { createStage, listStagesForAdmin, seedDefaultStages } from "@/lib/career-stages/admin";
import { computeStageHealthBatch } from "@/lib/academy-control/health";
import { loadAllStageNodes } from "@/lib/academy-control/service";
import { isStageStatus } from "@/lib/career-stages/types";

// `?health=1` folds Stage Health into the same response. The stage list page needs both, and asking
// for them separately meant one request for the list plus one per stage for its health — seven
// serverless invocations to draw six cards, each re-authenticating before it could do any work.
export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const params = new URL(request.url).searchParams;
  const stages = await listStagesForAdmin(access!);
  const payload: Record<string, unknown> = { stages };

  if (params.get("health") === "1") {
    payload.health = Object.fromEntries(await computeStageHealthBatch(access!.organizationId));
  }
  // `?nodes=1` returns every stage's program/module/group tree grouped by stage. The Brain queue
  // needs the tree for whichever stage each suggestion names, and resolving that per card meant
  // every card racing to fetch the same stage before any of them had cached it.
  if (params.get("nodes") === "1") {
    payload.nodes = await loadAllStageNodes(access!.organizationId);
  }
  return NextResponse.json(payload);
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
