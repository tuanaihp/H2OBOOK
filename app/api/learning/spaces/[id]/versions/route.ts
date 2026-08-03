import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/learning-intelligence/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { organizationId?: string; cloneFromVersionId?: string } | null;
  const access = await resolveOrganizationAccess(auth.user!, body?.organizationId, [...STAFF_ROLES]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data: space } = await supabase.from("knowledge_spaces").select("id").eq("id", id).eq("organization_id", access.organizationId).maybeSingle();
  if (!space) return NextResponse.json({ error: "SPACE_NOT_FOUND" }, { status: 404 });
  const { data: latest } = await supabase.from("knowledge_space_versions").select("version_number").eq("knowledge_space_id", id).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextNumber = Number(latest?.version_number ?? 0) + 1;

  const { data: version, error } = await supabase.from("knowledge_space_versions").insert({
    organization_id: access.organizationId, knowledge_space_id: id, version_number: nextNumber, status: "draft", title: `v${nextNumber}`, created_by: auth.user!.id
  }).select("id,version_number").single();
  if (error || !version) return NextResponse.json({ error: error?.message ?? "VERSION_CREATE_FAILED" }, { status: 400 });

  if (body?.cloneFromVersionId) {
    const { data: sourceSections } = await supabase.from("learning_sections").select("title,description,position,icon,required,learning_blocks(block_type,title,position,visibility,required,estimated_minutes,completion_weight,payload)").eq("version_id", body.cloneFromVersionId);
    for (const section of sourceSections ?? []) {
      const { data: newSection } = await supabase.from("learning_sections").insert({
        organization_id: access.organizationId, version_id: version.id, title: section.title, description: section.description, position: section.position, icon: section.icon, required: section.required
      }).select("id").single();
      if (!newSection) continue;
      const blocks = (section as unknown as { learning_blocks?: Record<string, unknown>[] }).learning_blocks ?? [];
      if (blocks.length) {
        await supabase.from("learning_blocks").insert(blocks.map((block) => ({ ...block, organization_id: access.organizationId, section_id: newSection.id })));
      }
    }
  }

  return NextResponse.json({ ok: true, version }, { status: 201 });
}
