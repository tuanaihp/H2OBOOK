import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessAccessSnapshot, BusinessOpportunity, OpportunityStatus } from "./types";

function mapOpportunity(row: Record<string, unknown>): BusinessOpportunity {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    customerName: String(row.customer_name),
    customerContact: (row.customer_contact ?? {}) as Record<string, string>,
    serviceName: String(row.service_name),
    estimatedValue: Number(row.estimated_value ?? 0),
    status: row.status as OpportunityStatus,
    source: row.source ? String(row.source) : null,
    nextActionAt: row.next_action_at ? String(row.next_action_at) : null,
    notes: row.notes ? String(row.notes) : null,
    sourceDomain: row.source_domain as BusinessOpportunity["sourceDomain"],
    updatedAt: String(row.updated_at)
  };
}

export async function getMyOpportunities(access: BusinessAccessSnapshot): Promise<BusinessOpportunity[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("business_opportunities").select("*").eq("owner_id", access.userId).order("updated_at", { ascending: false });
  return (data ?? []).map(mapOpportunity);
}

export interface UpsertOpportunityInput {
  customerName: string;
  serviceName: string;
  estimatedValue: number;
  status?: OpportunityStatus;
  source?: string;
  nextActionAt?: string;
  notes?: string;
  customerContact?: Record<string, string>;
  createAssetProjectId?: string;
}

export async function createOpportunity(access: BusinessAccessSnapshot, input: UpsertOpportunityInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const { data, error } = await supabase.from("business_opportunities").insert({
    organization_id: access.organizationId,
    owner_id: access.userId,
    customer_name: input.customerName,
    service_name: input.serviceName,
    estimated_value: input.estimatedValue,
    status: input.status ?? "new",
    source: input.source ?? null,
    next_action_at: input.nextActionAt ?? null,
    notes: input.notes ?? null,
    customer_contact: input.customerContact ?? {},
    source_domain: input.createAssetProjectId ? "create" : "manual",
    source_payload: input.createAssetProjectId ? { createProjectId: input.createAssetProjectId } : {}
  }).select("*").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "OPPORTUNITY_CREATE_FAILED" };
  return { ok: true as const, opportunity: mapOpportunity(data) };
}

export async function updateOpportunity(access: BusinessAccessSnapshot, opportunityId: string, input: Partial<UpsertOpportunityInput>) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "SUPABASE_NOT_CONFIGURED" };
  const patch: Record<string, unknown> = {};
  if (input.customerName !== undefined) patch.customer_name = input.customerName;
  if (input.serviceName !== undefined) patch.service_name = input.serviceName;
  if (input.estimatedValue !== undefined) patch.estimated_value = input.estimatedValue;
  if (input.status !== undefined) patch.status = input.status;
  if (input.source !== undefined) patch.source = input.source;
  if (input.nextActionAt !== undefined) patch.next_action_at = input.nextActionAt;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.customerContact !== undefined) patch.customer_contact = input.customerContact;

  const { data, error } = await supabase.from("business_opportunities").update(patch).eq("id", opportunityId).eq("owner_id", access.userId).select("*").maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "OPPORTUNITY_NOT_FOUND" };
  return { ok: true as const, opportunity: mapOpportunity(data) };
}
