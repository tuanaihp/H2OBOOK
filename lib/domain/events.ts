import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function emitDomainEvent(input: {
  organizationId: string;
  actorId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  eventName: string;
  payload?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, mode: "demo" as const };
  const { data, error } = await admin.from("domain_events").insert({
    organization_id: input.organizationId,
    actor_id: input.actorId ?? null,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    event_name: input.eventName,
    payload: input.payload ?? {}
  }).select("id").single();
  if (error) throw error;
  return { ok: true, id: data.id };
}

export async function recordServerAnalytics(input: {
  organizationId?: string | null;
  userId?: string | null;
  anonymousId?: string | null;
  eventName: string;
  resourceType?: string | null;
  resourceId?: string | null;
  sessionId?: string | null;
  properties?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("analytics_events").insert({
    event_id: crypto.randomUUID(),
    organization_id: input.organizationId ?? null,
    user_id: input.userId ?? null,
    anonymous_id: input.anonymousId ?? null,
    event_name: input.eventName,
    resource_type: input.resourceType ?? null,
    resource_id: input.resourceId ?? null,
    resource_client_key: null,
    session_id: input.sessionId ?? null,
    properties: input.properties ?? {},
    occurred_at: new Date().toISOString()
  });
}
