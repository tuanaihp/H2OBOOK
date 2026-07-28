import { createClient } from "@supabase/supabase-js";
import { createDecipheriv, createHash, createHmac } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secretMaterial = process.env.WEBHOOK_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
if (!url || !serviceKey || !secretMaterial) throw new Error("SUPABASE_AND_WEBHOOK_ENCRYPTION_REQUIRED");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const encryptionKey = createHash("sha256").update(secretMaterial).digest();
const pollMs = Math.max(500, Number(process.env.WEBHOOK_WORKER_POLL_MS || 2000));
const concurrency = Math.max(1, Math.min(25, Number(process.env.WEBHOOK_WORKER_CONCURRENCY || 5)));
let stopped = false;

function decrypt(value) {
  const [ivRaw, tagRaw, dataRaw] = String(value || "").split(".");
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error("WEBHOOK_SECRET_NOT_MIGRATED");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
}
function retryDelay(attempt) { return Math.min(6 * 60 * 60 * 1000, 3000 * 2 ** Math.max(0, attempt - 1)); }
async function deliver(row) {
  const { data: endpoint, error: endpointError } = await admin.from("webhook_endpoints").select("id,url,enabled,secret_ciphertext").eq("id", row.endpoint_id).maybeSingle();
  if (endpointError || !endpoint?.enabled) {
    await admin.from("webhook_deliveries").update({ status: "cancelled", last_error: endpointError?.message || "ENDPOINT_DISABLED" }).eq("id", row.id);
    return;
  }
  try {
    const secret = decrypt(endpoint.secret_ciphertext);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify(row.payload);
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const response = await fetch(endpoint.url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000), headers: { "content-type": "application/json", "user-agent": "H2OBOOK-Webhook/4.11", "x-h2obook-event": row.event_type, "x-h2obook-event-id": String(row.domain_event_id || row.event_id || row.request_id), "x-h2obook-timestamp": timestamp, "x-h2obook-signature": `sha256=${signature}`, "idempotency-key": String(row.request_id) }, body });
    const responseBody = (await response.text()).slice(0, 4000);
    if (!response.ok) throw Object.assign(new Error(`HTTP_${response.status}`), { responseStatus: response.status, responseBody });
    await Promise.all([
      admin.from("webhook_deliveries").update({ status: "delivered", delivered_at: new Date().toISOString(), response_status: response.status, response_body: responseBody, last_error: null }).eq("id", row.id),
      admin.from("webhook_endpoints").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", endpoint.id)
    ]);
  } catch (error) {
    const attempts = Number(row.attempt_count || 1);
    const final = attempts >= 8;
    const next = new Date(Date.now() + retryDelay(attempts)).toISOString();
    await Promise.all([
      admin.from("webhook_deliveries").update({ status: final ? "failed" : "retry", next_attempt_at: next, response_status: error.responseStatus || null, response_body: error.responseBody || null, last_error: error instanceof Error ? error.message : String(error) }).eq("id", row.id),
      admin.from("webhook_endpoints").update({ last_failure_at: new Date().toISOString(), failure_count: attempts }).eq("id", endpoint.id)
    ]);
  }
}
async function tick() {
  const { data, error } = await admin.rpc("claim_webhook_deliveries", { p_limit: concurrency });
  if (error) { console.error("claim failed", error.message); return; }
  await Promise.all((data || []).map(deliver));
}
async function loop() {
  console.log("H2OBOOK webhook worker 4.11 started");
  while (!stopped) { await tick(); await new Promise(resolve => setTimeout(resolve, pollMs)); }
}
process.on("SIGTERM", () => { stopped = true; });
process.on("SIGINT", () => { stopped = true; });
void loop();
