import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/learning-intelligence/service";

const REQUIRED_PAYLOAD_KEYS: Record<string, string[]> = {
  video: ["assetId"],
  assignment: ["instructions"],
  quiz: ["questions"]
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { organizationId?: string; blockType?: string; title?: string; visibility?: string; required?: boolean; estimatedMinutes?: number; completionWeight?: number; payload?: Record<string, unknown> } | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!body?.blockType) return NextResponse.json({ error: "BLOCK_TYPE_REQUIRED" }, { status: 400 });
  const requiredKeys = REQUIRED_PAYLOAD_KEYS[body.blockType] ?? [];
  const payload = body.payload ?? {};
  const missing = requiredKeys.filter((key) => payload[key] === undefined || payload[key] === "");
  if (missing.length) return NextResponse.json({ error: "BLOCK_PAYLOAD_INVALID", details: { missing } }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data: section } = await supabase.from("learning_sections").select("id,version_id,knowledge_space_versions!inner(status)").eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (!section) return NextResponse.json({ error: "SECTION_NOT_FOUND" }, { status: 404 });
  const versionStatus = (section as unknown as { knowledge_space_versions: { status: string } }).knowledge_space_versions?.status;
  if (versionStatus !== "draft") return NextResponse.json({ error: "VERSION_NOT_EDITABLE" }, { status: 409 });
  const { count } = await supabase.from("learning_blocks").select("id", { count: "exact", head: true }).eq("section_id", id);

  const { data, error } = await supabase.from("learning_blocks").insert({
    organization_id: access.organizationId, section_id: id, block_type: body.blockType, title: body.title ?? "",
    visibility: body.visibility ?? "all_entitled", required: body.required ?? true, estimated_minutes: body.estimatedMinutes ?? 0,
    completion_weight: body.completionWeight ?? 1, payload, position: count ?? 0
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, block: data }, { status: 201 });
}
