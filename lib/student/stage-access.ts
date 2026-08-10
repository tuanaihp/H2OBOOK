import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Real per-student career-stage unlock, keyed by career_stages.slug — the same key
// lib/content-access/facts.ts and /api/student/library already compare against.
//
// This used to unlock a hardcoded array from lib/student/experience.ts ("foundation" always free,
// four fake English-id stages behind membership) that predates the real 6-stage curriculum seeded
// in modules 25/26. Real career_stages.slug values look like "h2o-stage-01-foundation", so that
// fake set could never match a real stage's slug — every real stage read as permanently locked,
// for every student, regardless of membership. Invisible today only because every seeded resource
// is deliberately access='free_preview' (content-access/facts.ts grants those independently of
// stage-unlock); the moment stage_locked resources are turned on, this would have blocked
// everyone from stage-gated content they were actually entitled to.
//
// No new table: manual per-stage grants reuse business_feature_grants (module 13) — it is already
// a generic text-keyed grant table, and a stage slug is just another feature_slug value in the same
// shape (source_type/expires_at/reason already fit). Nothing in the app currently writes a
// stage-slug grant through this table (grep-confirmed), so this branch was — and remains —
// dormant until an admin surface for it exists; left in place rather than removed since it costs
// nothing and the shape is already correct.
export async function getUnlockedStageIds(userId: string, organizationId: string): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new Set<string>();

  const nowIso = new Date().toISOString();
  const [{ data: stageRows }, { data: membership }, { data: grants }] = await Promise.all([
    supabase.from("career_stages").select("slug,position").eq("organization_id", organizationId).eq("status", "active").order("position", { ascending: true }),
    supabase.from("memberships").select("id").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active").or(`expires_at.is.null,expires_at.gt.${nowIso}`).limit(1).maybeSingle(),
    supabase.from("business_feature_grants").select("feature_slug").eq("organization_id", organizationId).eq("user_id", userId).eq("source_type", "manual_grant").is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  ]);

  const stages = (stageRows ?? []) as { slug: string; position: number }[];
  const unlocked = new Set<string>();
  if (stages[0]) unlocked.add(stages[0].slug);
  if (membership) for (const stage of stages) unlocked.add(stage.slug);
  for (const grant of grants ?? []) unlocked.add(String(grant.feature_slug));
  return unlocked;
}
