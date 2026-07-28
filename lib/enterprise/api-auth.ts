import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "./api-key";

function presentedKey(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return request.headers.get("x-api-key")?.trim() ?? "";
}
function safeHashEquals(left: string, right: string) {
  const a = Buffer.from(left, "hex"), b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function authenticatePublicApi(request: Request, requiredScope?: string) {
  const raw = presentedKey(request);
  if (!raw.startsWith("h2o_")) return { auth: null, response: NextResponse.json({ error: "API_KEY_REQUIRED" }, { status: 401 }) };
  const admin = createSupabaseAdminClient();
  if (!admin) return { auth: null, response: NextResponse.json({ error: "PUBLIC_API_NOT_CONFIGURED" }, { status: 503 }) };
  const digest = hashApiKey(raw);
  const { data: keys } = await admin.from("public_api_keys").select("id,organization_id,key_hash,scopes,expires_at,revoked_at").eq("key_prefix", raw.slice(0, 16)).limit(10);
  const key = keys?.find(item => safeHashEquals(String(item.key_hash), digest));
  if (!key || key.revoked_at || (key.expires_at && new Date(key.expires_at).getTime() <= Date.now())) return { auth: null, response: NextResponse.json({ error: "API_KEY_INVALID" }, { status: 401 }) };
  const scopes = Array.isArray(key.scopes) ? key.scopes.map(String) : [];
  if (requiredScope && !scopes.includes(requiredScope) && !scopes.includes("*")) return { auth: null, response: NextResponse.json({ error: "API_SCOPE_FORBIDDEN", requiredScope }, { status: 403 }) };
  await admin.from("public_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
  return { auth: { keyId: String(key.id), organizationId: String(key.organization_id), scopes }, response: null };
}
