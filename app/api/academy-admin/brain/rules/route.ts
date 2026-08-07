import { NextResponse } from "next/server";
import { resolveAcademyAdminAccess } from "@/lib/academy-admin/request";
import { createRule } from "@/lib/brain/admin";
import { loadBrainRules } from "@/lib/brain/service";
import { toRuleAction, toRuleConditions } from "@/lib/brain/types";

export async function GET(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const items = await loadBrainRules(access!.organizationId);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const { access, response } = await resolveAcademyAdminAccess(request);
  if (response) return response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (typeof body?.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  // The RLS policy is what actually restricts rule writes to owner; parsing here only keeps
  // unrecognised condition/action shapes out of the stored jsonb.
  const result = await createRule(access!, {
    name: body.name,
    priority: typeof body.priority === "number" ? body.priority : undefined,
    conditions: toRuleConditions(body.conditions),
    actions: toRuleAction(body.actions)
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.data, { status: 201 });
}
