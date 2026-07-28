import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function writeDomainAudit(input: {
  organizationId: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  const client = await createSupabaseServerClient();
  if (!client) return;
  await client.from("audit_logs").insert({
    organization_id: input.organizationId,
    actor_id: input.actorId,
    action: input.action,
    resource_type: input.resource,
    resource_id: input.resourceId ?? null,
    metadata: input.metadata ?? {}
  });
}
