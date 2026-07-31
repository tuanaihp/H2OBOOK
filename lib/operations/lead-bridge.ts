import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One-way, additive bridge from the public academy_applications funnel into the
 * internal Operations CRM (admission_leads). It only ever adds/updates visibility
 * for the sales/admissions team — it must never throw into, block, or alter the
 * academy_applications approval/entitlement flow that actually grants student
 * access. Every call site wraps this in the caller's own best-effort handling,
 * but this function also swallows its own errors as a second safety net.
 */
export async function syncAdmissionLeadFromApplication(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    email: string;
    name: string;
    phone?: string;
    interest: string;
    stage: "new" | "enrolled" | "lost";
    note: string;
  }
): Promise<void> {
  try {
    const email = input.email.trim().toLowerCase();
    if (!email) return;
    const { data: existing } = await admin
      .from("admission_leads")
      .select("id,notes")
      .eq("organization_id", input.organizationId)
      .eq("source", "academy_public")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const now = new Date().toISOString();
    if (existing) {
      await admin
        .from("admission_leads")
        .update({
          stage: input.stage,
          interest: input.interest,
          notes: [existing.notes, input.note].filter(Boolean).join("\n"),
          updated_at: now
        })
        .eq("id", existing.id);
      return;
    }
    await admin.from("admission_leads").insert({
      organization_id: input.organizationId,
      name: input.name,
      email,
      phone: input.phone?.trim() || "",
      source: "academy_public",
      interest: input.interest,
      stage: input.stage,
      notes: input.note,
      created_at: now,
      updated_at: now
    });
  } catch {
    // Best-effort CRM visibility only; never let a lead-sync failure surface
    // to the caller or affect the real academy_applications state machine.
  }
}
