import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/enterprise/secret-box";

export type AiProviderKind = "gemini" | "openai" | "xai";
export const AI_PROVIDER_KINDS: AiProviderKind[] = ["gemini", "openai", "xai"];

export interface AiProviderCredentialSummary {
  id: string; provider: AiProviderKind; label: string; apiKeyLast4: string;
  capabilities: string[]; status: "untested" | "connected" | "failed";
  lastTestedAt: string | null; lastTestError: string | null; enabled: boolean; createdAt: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

interface Row {
  id: string; provider: AiProviderKind; label: string; api_key_last4: string;
  capabilities: string[]; status: "untested" | "connected" | "failed";
  last_tested_at: string | null; last_test_error: string | null; enabled: boolean; created_at: string;
}
function toSummary(row: Row): AiProviderCredentialSummary {
  return {
    id: row.id, provider: row.provider, label: row.label, apiKeyLast4: row.api_key_last4,
    capabilities: row.capabilities ?? [], status: row.status, lastTestedAt: row.last_tested_at,
    lastTestError: row.last_test_error, enabled: row.enabled, createdAt: row.created_at
  };
}

/** Never selects api_key_ciphertext — the raw/encrypted key is only ever read back inside testProviderCredential/getDecryptedProviderKey, both server-only and never returned to a client. */
export async function listProviderCredentials(organizationId: string): Promise<AiProviderCredentialSummary[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("ai_provider_credentials")
    .select("id,provider,label,api_key_last4,capabilities,status,last_tested_at,last_test_error,enabled,created_at")
    .eq("organization_id", organizationId).order("created_at", { ascending: false });
  return ((data ?? []) as Row[]).map(toSummary);
}

export async function createProviderCredential(organizationId: string, actorId: string, input: { provider: AiProviderKind; label: string; apiKey: string; capabilities: string[] }): Promise<Result<{ id: string }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  if (!input.apiKey.trim()) return { ok: false, error: "API_KEY_REQUIRED" };
  if (!AI_PROVIDER_KINDS.includes(input.provider)) return { ok: false, error: "UNKNOWN_PROVIDER" };

  let ciphertext: string;
  try { ciphertext = encryptSecret(input.apiKey.trim()); }
  catch { return { ok: false, error: "ENCRYPTION_KEY_NOT_CONFIGURED" }; }

  const { data, error } = await supabase.from("ai_provider_credentials").insert({
    organization_id: organizationId, provider: input.provider, label: input.label || input.provider,
    api_key_ciphertext: ciphertext, api_key_last4: input.apiKey.trim().slice(-4),
    capabilities: input.capabilities, status: "untested", created_by: actorId
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "CREATE_FAILED" };
  return { ok: true, data: { id: data.id } };
}

export async function deleteProviderCredential(organizationId: string, id: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { error } = await supabase.from("ai_provider_credentials").delete().eq("organization_id", organizationId).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

const MODELS_ENDPOINT: Record<AiProviderKind, (key: string) => { url: string; headers: Record<string, string> }> = {
  gemini: (key) => ({ url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, headers: {} }),
  openai: (key) => ({ url: "https://api.openai.com/v1/models", headers: { authorization: `Bearer ${key}` } }),
  xai: (key) => ({ url: "https://api.x.ai/v1/models", headers: { authorization: `Bearer ${key}` } })
};

/**
 * Real connection test — a lightweight "list models" GET against the provider's own API using the
 * decrypted key, not a fake status flip. Chosen specifically because it costs no generation tokens on
 * any of the 3 providers, only confirms the key authenticates. Result (connected/failed + reason) is
 * persisted so the admin UI reflects real, current state without needing this endpoint on every page load.
 */
export async function testProviderCredential(organizationId: string, id: string): Promise<Result<{ status: "connected" | "failed"; error: string | null }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const { data } = await supabase.from("ai_provider_credentials").select("provider,api_key_ciphertext").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "CREDENTIAL_NOT_FOUND" };
  const row = data as { provider: AiProviderKind; api_key_ciphertext: string };

  let apiKey: string;
  try { apiKey = decryptSecret(row.api_key_ciphertext); }
  catch { return { ok: false, error: "ENCRYPTION_KEY_NOT_CONFIGURED" }; }

  const { url, headers } = MODELS_ENDPOINT[row.provider](apiKey);
  let status: "connected" | "failed" = "failed";
  let testError: string | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) status = "connected";
    else testError = `HTTP ${response.status}`;
  } catch (error) {
    testError = error instanceof Error ? error.message : "NETWORK_ERROR";
  }

  const now = new Date().toISOString();
  await supabase.from("ai_provider_credentials").update({ status, last_tested_at: now, last_test_error: testError, updated_at: now }).eq("organization_id", organizationId).eq("id", id);
  return { ok: true, data: { status, error: testError } };
}

/**
 * The actual "gateway" seam — server-only, for a future feature to call once it wants to use an
 * org-configured key instead of (or in addition to) a global env var like GEMINI_API_KEY. Returns the
 * first enabled credential for that provider; nothing in the app calls this yet (see docs/ai-provider-
 * gateway-v1's scope note — wiring this into real generation features is an explicit next step, not
 * part of this pass).
 */
export async function getDecryptedProviderKey(organizationId: string, provider: AiProviderKind): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("ai_provider_credentials").select("api_key_ciphertext").eq("organization_id", organizationId).eq("provider", provider).eq("enabled", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  try { return decryptSecret((data as { api_key_ciphertext: string }).api_key_ciphertext); }
  catch { return null; }
}
