import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveWorkspaceSnapshot(input: { organizationId: string; userId: string; payload: unknown; clientVersion: number }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { id: `demo_${crypto.randomUUID()}`, version: input.clientVersion, mode: "demo" as const };
  const { data, error } = await supabase.from("workspace_snapshots").insert({ organization_id: input.organizationId, created_by: input.userId, client_version: input.clientVersion, payload: input.payload }).select("id,client_version,created_at").single();
  if (error) throw error;
  return { ...data, mode: "cloud" as const };
}

export async function latestWorkspaceSnapshot(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("workspace_snapshots").select("id,client_version,payload,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
