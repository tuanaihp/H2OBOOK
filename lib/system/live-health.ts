import "server-only";
import { getRuntimeCapabilities, isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EnvironmentName, ServiceHealthCheck } from "./types";

export function currentEnvironment(): EnvironmentName {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production" || vercelEnv === "preview") return vercelEnv;
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

// Real live check: the only service this pass actually pings, since it is cheap, already uses
// the trusted service-role client, and is the single most consequential dependency. Every other
// configured-but-unverified service reports connection "not_tested" / operational "unknown"
// rather than a fabricated "healthy" — CLAUDE_INTEGRATION_PROMPT.md §"Production pages must
// never display demo counters or static healthy states" is taken literally here: "unknown" is
// the honest answer when there is no real evidence yet, not "healthy".
async function checkSupabaseLive(): Promise<Pick<ServiceHealthCheck, "connection" | "operational" | "latencyMs" | "message">> {
  if (!isSupabaseConfigured()) return { connection: "not_tested", operational: "down", message: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL/ANON_KEY." };
  const admin = createSupabaseAdminClient();
  if (!admin) return { connection: "not_tested", operational: "unknown", message: "Không khởi tạo được service-role client." };
  const startedAt = Date.now();
  const { error } = await admin.from("organizations").select("id").limit(1);
  const latencyMs = Date.now() - startedAt;
  if (error) return { connection: "failed", operational: "down", latencyMs, message: error.message };
  return { connection: "connected", operational: "healthy", latencyMs };
}

export async function getLiveServiceChecks(): Promise<ServiceHealthCheck[]> {
  const checkedAt = new Date().toISOString();
  const capabilities = getRuntimeCapabilities();
  const supabaseLive = await checkSupabaseLive();

  return capabilities.map((capability): ServiceHealthCheck => {
    const configuration = capability.configured ? "configured" : capability.required ? "missing" : "not_required";
    if (capability.key === "database") {
      return { key: capability.key, label: capability.label, description: capability.description, required: capability.required, configuration, checkedAt, evidenceSource: "live_query:organizations", ...supabaseLive };
    }
    const connection: ServiceHealthCheck["connection"] = "not_tested";
    const operational: ServiceHealthCheck["operational"] = capability.configured ? "unknown" : capability.required ? "down" : "unknown";
    return {
      key: capability.key, label: capability.label, description: capability.description, required: capability.required,
      configuration, connection, operational, checkedAt,
      evidenceSource: "env_config",
      message: capability.configured ? "Đã cấu hình — chưa có kiểm tra kết nối thực tế cho dịch vụ này." : undefined
    };
  });
}
