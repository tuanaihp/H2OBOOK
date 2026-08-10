import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { studentCareerStages } from "@/lib/student/experience";
import type { OutcomeAccessContext } from "@/lib/student/create-outcome";

// requiredStageKey (lib/student/create-outcome.ts) is its own self-contained 5-tier progression
// scale for the recipe catalog — a "how advanced is this template" label, not a reference to a
// real career_stages row. studentCareerStages (experience.ts) only supplies that tier vocabulary
// here; it is not compared against real curriculum data anywhere in this file.
const ALL_STAGE_KEYS = studentCareerStages.map((stage) => stage.id);
const FREE_STAGE_KEYS = studentCareerStages[0] ? [studentCareerStages[0].id] : [];

// Shared by /student/create (Outcome Hub) and /student/learn (Learn-to-Create suggestions) so
// "unlocked" means exactly the same thing in both places — one access resolution, not two.
//
// unlockedStageKeys used to come from studentCareerStages' own hardcoded `status` field
// (`stage.status !== "locked"`), which is a fixed property of the array itself — identical for
// every student regardless of their real membership. Every student saw the exact same two tiers
// unlocked and the same three locked, forever. Fixed to derive from the real hasActiveMembership
// signal this function already computes: free tier for everyone, every tier once membership is
// active — the same "first tier free, membership unlocks the rest" rule stage-access.ts uses for
// the real curriculum, applied here to the recipe catalog's own tier scale.
export async function loadOutcomeAccessContext(userId: string, role: string): Promise<OutcomeAccessContext> {
  if (["owner", "admin", "teacher"].includes(role)) return { isStaff: true, unlockedStageKeys: ALL_STAGE_KEYS, hasActiveMembership: true };
  if (!isSupabaseConfigured()) return { isStaff: false, unlockedStageKeys: FREE_STAGE_KEYS, hasActiveMembership: false };
  const admin = createSupabaseAdminClient();
  const organizationId = await configuredAcademyOrganizationId();
  if (!admin || !organizationId) return { isStaff: false, unlockedStageKeys: FREE_STAGE_KEYS, hasActiveMembership: false };
  const { data } = await admin.from("entitlements").select("resource_type,expires_at").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active").eq("resource_type", "membership");
  const now = Date.now();
  const hasActiveMembership = (data ?? []).some((row) => !row.expires_at || new Date(String(row.expires_at)).getTime() > now);
  return { isStaff: false, unlockedStageKeys: hasActiveMembership ? ALL_STAGE_KEYS : FREE_STAGE_KEYS, hasActiveMembership };
}
