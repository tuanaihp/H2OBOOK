import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { studentCareerStages } from "./experience";

// Real per-student career-stage unlock. studentCareerStages (experience.ts) previously hardcoded
// the same status for every user ("foundation" always shown as completed, everyone else always
// locked) — this replaces that with a real signal: the first stage is free for any real student,
// every later stage unlocks with an active real membership (public.memberships, already the
// source of truth for the paid-access commerce flow — see docs/DATA_DICTIONARY_MAIN_AUDIT.md §2)
// or an explicit admin manual grant. No new table: manual per-stage grants reuse
// business_feature_grants (module 13) — it is already a generic text-keyed grant table, not
// exclusively for BusinessFeature slugs, and a stage id ("practice", "leader", ...) is just
// another feature_slug value in the same shape (source_type/expires_at/reason already fit).
const FREE_STAGE_ID = studentCareerStages[0]?.id ?? "foundation";

export async function getUnlockedStageIds(userId: string, organizationId: string): Promise<Set<string>> {
  const unlocked = new Set<string>([FREE_STAGE_ID]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return unlocked;

  const nowIso = new Date().toISOString();
  const [{ data: membership }, { data: grants }] = await Promise.all([
    supabase.from("memberships").select("id").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active").or(`expires_at.is.null,expires_at.gt.${nowIso}`).limit(1).maybeSingle(),
    supabase.from("business_feature_grants").select("feature_slug").eq("organization_id", organizationId).eq("user_id", userId).eq("source_type", "manual_grant").is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  ]);

  if (membership) for (const stage of studentCareerStages) unlocked.add(stage.id);
  for (const grant of grants ?? []) unlocked.add(String(grant.feature_slug));
  return unlocked;
}
