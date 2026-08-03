import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recomputeSpaceProgress } from "@/lib/learning-intelligence/service";

// blockId is the only client-supplied identifier; organization/space/version are always resolved
// server-side from it so a client can never write progress into a space it does not belong to.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { blockId?: string; percent?: number; lastPositionSeconds?: number; response?: Record<string, unknown> } | null;
  if (!body?.blockId || typeof body.percent !== "number") return NextResponse.json({ error: "BLOCK_ID_AND_PERCENT_REQUIRED" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data: block } = await supabase
    .from("learning_blocks")
    .select("id,organization_id,section_id,learning_sections!inner(version_id,knowledge_space_versions!inner(knowledge_space_id))")
    .eq("id", body.blockId).maybeSingle();
  if (!block) return NextResponse.json({ error: "BLOCK_NOT_FOUND" }, { status: 404 });
  const section = (block as unknown as { learning_sections: { version_id: string; knowledge_space_versions: { knowledge_space_id: string } } }).learning_sections;
  const percent = Math.max(0, Math.min(100, Math.round(body.percent)));

  const { error } = await supabase.from("block_progress").upsert({
    organization_id: block.organization_id, user_id: auth.user!.id, block_id: block.id, percent,
    completed_at: percent >= 100 ? new Date().toISOString() : null,
    last_position_seconds: body.lastPositionSeconds ?? null, response: body.response ?? {}, updated_at: new Date().toISOString()
  }, { onConflict: "user_id,block_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const space = await recomputeSpaceProgress(supabase, String(block.organization_id), auth.user!.id, section.knowledge_space_versions.knowledge_space_id, section.version_id);
  return NextResponse.json({ ok: true, spaceProgress: space });
}
