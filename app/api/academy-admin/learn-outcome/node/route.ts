import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import {
  attachMissionBinding, createActionTemplate, createMilestone, createMission,
  createOutcome, deleteMilestone, deleteOutcome, removeMissionBinding, reorderTreeNode,
  updateMilestone, updateMission, updateOutcome
} from "@/lib/learn-outcome/admin";
import type { MissionBindingRole, MissionInput } from "@/lib/learn-outcome/types";

type Body = {
  action?: string;
  versionId?: string; outcomeId?: string; milestoneId?: string; missionId?: string; bindingId?: string;
  nodeId?: string; nodeType?: "outcome" | "milestone" | "mission"; direction?: -1 | 1;
  title?: string; description?: string; position?: number;
  mission?: MissionInput;
  binding?: { kind?: "resource" | "tool" | "assignment"; resourceType?: string; resourceId?: string; toolType?: string; toolId?: string; assignmentId?: string; role?: MissionBindingRole };
  actionTemplate?: { title?: string; description?: string; required?: boolean; dayOffset?: number | null; evidenceRequired?: boolean };
};

// One dispatcher for every graph-node write below the version level — the same {action, ...} shape
// as version/route.ts, kept as one route rather than one per node type since every branch is a thin
// pass-through to lib/learn-outcome/admin.ts, which does the real validation.
export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.action) return NextResponse.json({ error: "ACTION_REQUIRED" }, { status: 400 });

  switch (body.action) {
    case "createOutcome": {
      if (!body.versionId || !body.title) return NextResponse.json({ error: "VERSION_AND_TITLE_REQUIRED" }, { status: 400 });
      const result = await createOutcome(access!, body.versionId, { title: body.title, description: body.description });
      return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "updateOutcome": {
      if (!body.outcomeId) return NextResponse.json({ error: "OUTCOME_REQUIRED" }, { status: 400 });
      const result = await updateOutcome(access!, body.outcomeId, { title: body.title, description: body.description, position: body.position });
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "deleteOutcome": {
      if (!body.outcomeId) return NextResponse.json({ error: "OUTCOME_REQUIRED" }, { status: 400 });
      const result = await deleteOutcome(access!, body.outcomeId);
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "createMilestone": {
      if (!body.outcomeId || !body.title) return NextResponse.json({ error: "OUTCOME_AND_TITLE_REQUIRED" }, { status: 400 });
      const result = await createMilestone(access!, body.outcomeId, { title: body.title, description: body.description });
      return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "updateMilestone": {
      if (!body.milestoneId) return NextResponse.json({ error: "MILESTONE_REQUIRED" }, { status: 400 });
      const result = await updateMilestone(access!, body.milestoneId, { title: body.title, description: body.description, position: body.position });
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "deleteMilestone": {
      if (!body.milestoneId) return NextResponse.json({ error: "MILESTONE_REQUIRED" }, { status: 400 });
      const result = await deleteMilestone(access!, body.milestoneId);
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "reorder": {
      if (!body.nodeId || !body.nodeType || (body.direction !== -1 && body.direction !== 1)) return NextResponse.json({ error: "NODE_TYPE_DIRECTION_REQUIRED" }, { status: 400 });
      const result = await reorderTreeNode(access!, body.nodeType, body.nodeId, body.direction);
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "createMission": {
      if (!body.milestoneId || !body.mission?.title || !body.mission.expectedResult) return NextResponse.json({ error: "MILESTONE_TITLE_RESULT_REQUIRED" }, { status: 400 });
      const result = await createMission(access!, body.milestoneId, body.mission);
      return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "updateMission": {
      if (!body.missionId || !body.mission) return NextResponse.json({ error: "MISSION_REQUIRED" }, { status: 400 });
      const result = await updateMission(access!, body.missionId, body.mission);
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "attachBinding": {
      if (!body.missionId || !body.binding?.kind) return NextResponse.json({ error: "MISSION_AND_KIND_REQUIRED" }, { status: 400 });
      const result = await attachMissionBinding(access!, body.missionId, body.binding.kind, body.binding);
      return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "removeBinding": {
      if (!body.bindingId || !body.binding?.kind) return NextResponse.json({ error: "BINDING_AND_KIND_REQUIRED" }, { status: 400 });
      const result = await removeMissionBinding(access!, body.binding.kind, body.bindingId);
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    case "createActionTemplate": {
      const title = body.actionTemplate?.title;
      if (!body.missionId || !title) return NextResponse.json({ error: "MISSION_AND_TITLE_REQUIRED" }, { status: 400 });
      const result = await createActionTemplate(access!, body.missionId, { ...body.actionTemplate, title });
      return result.ok ? NextResponse.json(result.data, { status: 201 }) : NextResponse.json({ error: result.error }, { status: 400 });
    }
    default:
      return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  }
}
