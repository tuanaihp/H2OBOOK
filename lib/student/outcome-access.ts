import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { studentCareerStages } from "@/lib/student/experience";
import type { OutcomeAccessContext } from "@/lib/student/create-outcome";

// Shared by /student/create (Outcome Hub) and /student/learn (Learn-to-Create suggestions) so
// "unlocked" means exactly the same thing in both places — one access resolution, not two.
export async function loadOutcomeAccessContext(userId: string, role: string): Promise<OutcomeAccessContext> {
  const unlockedStageKeys = studentCareerStages.filter((stage) => stage.status !== "locked").map((stage) => stage.id);
  if (["owner", "admin", "teacher"].includes(role)) return { isStaff: true, unlockedStageKeys, hasActiveMembership: true };
  if (!isSupabaseConfigured()) return { isStaff: false, unlockedStageKeys, hasActiveMembership: false };
  const admin = createSupabaseAdminClient();
  const organizationId = await configuredAcademyOrganizationId();
  if (!admin || !organizationId) return { isStaff: false, unlockedStageKeys, hasActiveMembership: false };
  const { data } = await admin.from("entitlements").select("resource_type,expires_at").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active").eq("resource_type", "membership");
  const now = Date.now();
  const hasActiveMembership = (data ?? []).some((row) => !row.expires_at || new Date(String(row.expires_at)).getTime() > now);
  return { isStaff: false, unlockedStageKeys, hasActiveMembership };
}
