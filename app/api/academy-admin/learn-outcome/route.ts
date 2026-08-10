import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { getOrCreateBlueprint } from "@/lib/learn-outcome/admin";
import { loadBlueprintForStage, listBlueprintVersions, loadVersionGraph, resolveResourceTitles } from "@/lib/learn-outcome/service";

// One stage's Journey Map: the blueprint, every version (for the version picker/history), and the
// full nested graph of whichever version is selected (?versionId=) or the latest one otherwise —
// with every resource binding's real title resolved server-side (docs/journey-v2 §8: the Admin
// Builder must never show a resource_id as its primary label).
export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const params = new URL(request.url).searchParams;
  const stageId = params.get("stageId");
  if (!stageId) return NextResponse.json({ error: "STAGE_ID_REQUIRED" }, { status: 400 });

  const blueprint = await loadBlueprintForStage(access!.organizationId, stageId);
  if (!blueprint) return NextResponse.json({ blueprint: null, versions: [], outcomes: [] });

  const versions = await listBlueprintVersions(access!.organizationId, blueprint.id);
  const versionId = params.get("versionId") || versions[0]?.id;
  const outcomes = versionId ? await loadVersionGraph(access!.organizationId, versionId) : [];
  const titleById = await resolveResourceTitles(access!.organizationId, outcomes.flatMap((o) => o.milestones.flatMap((m) => m.missions.flatMap((mission) => mission.resourceBindings))));
  const resolvedOutcomes = outcomes.map((o) => ({
    ...o,
    milestones: o.milestones.map((m) => ({
      ...m,
      missions: m.missions.map((mission) => ({
        ...mission,
        resourceBindings: mission.resourceBindings.map((b) => ({ ...b, title: titleById.get(b.resourceId) ?? null }))
      }))
    }))
  }));
  return NextResponse.json({ blueprint, versions, selectedVersionId: versionId ?? null, outcomes: resolvedOutcomes });
}

// Creates the blueprint (and its first draft version) the first time Admin opens Journey Map for a
// stage that doesn't have one yet. Safe to call again: getOrCreateBlueprint returns the existing one.
export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as { stageId?: string; title?: string } | null;
  if (!body?.stageId) return NextResponse.json({ error: "STAGE_ID_REQUIRED" }, { status: 400 });
  const result = await getOrCreateBlueprint(access!, body.stageId, body.title ?? "Journey Map");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data, { status: 201 });
}
