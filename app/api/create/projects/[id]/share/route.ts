import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "Xuất & chia sẻ" for this pass is a public share link (readiness gate enforced below), not a
// rendered PDF/image file — see the integration report for the deferred real export pipeline.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { caption?: string; channel?: string } | null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data: project } = await supabase.from("create_outcome_projects").select("id,organization_id,readiness_score,skill_keys").eq("id", id).eq("owner_user_id", auth.user!.id).maybeSingle();
  if (!project) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  if (Number(project.readiness_score) < 60) return NextResponse.json({ error: "PROJECT_NOT_READY", details: { readinessScore: project.readiness_score, minimum: 60 } }, { status: 409 });

  const slug = `p-${id.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase.from("create_outcome_shares").insert({
    organization_id: project.organization_id,
    project_id: id,
    owner_user_id: auth.user!.id,
    channel: body?.channel && ["link", "facebook", "portfolio", "instructor"].includes(body.channel) ? body.channel : "link",
    public_slug: slug,
    caption: body?.caption?.trim() ?? ""
  }).select("public_slug").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "SHARE_CREATE_FAILED" }, { status: 400 });

  await supabase.from("create_outcome_projects").update({ status: "published" }).eq("id", id).eq("owner_user_id", auth.user!.id);

  // Learn Mastery Engine V1: a shared, ready outcome project is real "create" evidence for
  // every skill it's tagged with — best-effort, never blocks the share response.
  const skillKeys = Array.isArray(project.skill_keys) ? project.skill_keys.map(String) : [];
  if (skillKeys.length) {
    try {
      await supabase.from("learning_skill_evidence").upsert(skillKeys.map((skillKey) => ({
        organization_id: project.organization_id, user_id: auth.user!.id, skill_key: skillKey,
        evidence_kind: "create", source_type: "create_outcome_project", source_id: id,
        score: Number(project.readiness_score), occurred_at: new Date().toISOString()
      })), { onConflict: "user_id,skill_key,evidence_kind,source_type,source_id" });
    } catch { /* best-effort skill evidence; never block the share response */ }
  }

  return NextResponse.json({ ok: true, publicSlug: data.public_slug, url: `/verify-outcome/${data.public_slug}` }, { status: 201 });
}
