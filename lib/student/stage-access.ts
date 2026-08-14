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

export interface CurrentStageLabel { title: string; indexLabel: string }

/**
 * Batched sibling of getUnlockedStageIds() for an admin list (2026-08-14, /academy-admin/
 * distribution) — one query per table for the whole student list instead of 3 queries per row.
 * Same unlock rule (first stage free / active membership unlocks all / manual grant), "current"
 * meaning the highest-position stage each student has unlocked — matches what
 * /api/student/journey shows that same student as their own current stage, so the admin list and
 * the student's own view never disagree about what "current" means.
 */
export async function getCurrentStageLabelsForStudents(organizationId: string, userIds: string[]): Promise<Map<string, CurrentStageLabel | null>> {
  const result = new Map<string, CurrentStageLabel | null>();
  if (!userIds.length) return result;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return result;

  const nowIso = new Date().toISOString();
  const [{ data: stageRows }, { data: memberships }, { data: grants }] = await Promise.all([
    supabase.from("career_stages").select("slug,position,title,index_label").eq("organization_id", organizationId).eq("status", "active").order("position", { ascending: true }),
    supabase.from("memberships").select("user_id").eq("organization_id", organizationId).in("user_id", userIds).eq("status", "active").or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    supabase.from("business_feature_grants").select("user_id,feature_slug").eq("organization_id", organizationId).in("user_id", userIds).eq("source_type", "manual_grant").is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  ]);

  const stages = (stageRows ?? []) as { slug: string; position: number; title: string; index_label: string | null }[];
  const membersWithActiveMembership = new Set(((memberships ?? []) as { user_id: string }[]).map((row) => row.user_id));
  const grantsByUser = new Map<string, Set<string>>();
  for (const grant of (grants ?? []) as { user_id: string; feature_slug: string }[]) {
    if (!grantsByUser.has(grant.user_id)) grantsByUser.set(grant.user_id, new Set());
    grantsByUser.get(grant.user_id)!.add(grant.feature_slug);
  }

  for (const userId of userIds) {
    const unlockedSlugs = new Set<string>();
    if (stages[0]) unlockedSlugs.add(stages[0].slug);
    if (membersWithActiveMembership.has(userId)) for (const stage of stages) unlockedSlugs.add(stage.slug);
    for (const slug of grantsByUser.get(userId) ?? []) unlockedSlugs.add(slug);
    const current = [...stages].reverse().find((s) => unlockedSlugs.has(s.slug));
    result.set(userId, current ? { title: current.title, indexLabel: current.index_label ?? "" } : null);
  }
  return result;
}

/**
 * "Current stage" for a student = the highest-position stage they have unlocked THAT ACTUALLY HAS a
 * published journey — not just the highest-position unlocked stage. Bug found 2026-08-14: an admin
 * granted a student Stage 2 and Stage 3 ahead of time (testing the grant feature built this session)
 * while only Stage 1 had a published journey (Stage 2 = draft only, Stage 3 = no blueprint at all).
 * The old plain "highest unlocked" resolution (app/student/courses/page.tsx,
 * app/api/student/journey/route.ts, app/student/roadmap/page.tsx all duplicated this same
 * `.reverse().find()` line) picked Stage 3 and hard-failed with "Giai đoạn này đang được xây dựng
 * hành trình" — the student could no longer reach Stage 1's real, finished content at all. Falls back
 * to the plain highest-unlocked stage only if NONE of the unlocked stages have a published journey
 * (a real "nothing built yet" state, which should still say so).
 */
export async function resolveCurrentStageId(organizationId: string, orderedStages: { id: string; slug: string; position: number }[], unlockedSlugs: Set<string>): Promise<string | null> {
  const unlockedDesc = [...orderedStages].filter((s) => unlockedSlugs.has(s.slug)).sort((a, b) => b.position - a.position);
  if (!unlockedDesc.length) return orderedStages[0]?.id ?? null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return unlockedDesc[0].id;

  const { data } = await supabase.from("learning_journey_blueprints").select("stage_id").eq("organization_id", organizationId).not("current_published_version_id", "is", null);
  const publishedStageIds = new Set(((data ?? []) as { stage_id: string }[]).map((row) => row.stage_id));
  return unlockedDesc.find((s) => publishedStageIds.has(s.id))?.id ?? unlockedDesc[0].id;
}
