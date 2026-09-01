import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isR2Configured } from "@/lib/runtime-config";

const GIB = 1024 * 1024 * 1024;

export type StorageLevel = "ok" | "warn" | "critical";

export interface StorageHealth {
  provider: "r2";
  configured: boolean;
  usedBytes: number;
  limitBytes: number;
  ratio: number;
  warnRatio: number;
  criticalRatio: number;
  level: StorageLevel;
}

function envNumber(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * Self-metered storage usage for one organization — sum of asset bytes we stored. No Cloudflare
 * API dependency. Powers the Admin "storage nearly full" banner and, later, the Google Drive
 * failover trigger (Phase 2).
 */
export async function getStorageHealth(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StorageHealth> {
  const limitBytes = envNumber("R2_LIMIT_BYTES", 10 * GIB); // R2 free tier = 10 GiB storage
  const warnRatio = Math.min(1, envNumber("R2_WARN_RATIO", 0.8));
  const criticalRatio = Math.min(1, envNumber("R2_CRITICAL_RATIO", 0.95));

  let usedBytes = 0;
  const { data, error } = await supabase.rpc("org_asset_storage_used_bytes", {
    p_organization_id: organizationId,
  });
  if (!error && data !== null && data !== undefined) {
    usedBytes = Number(data) || 0;
  } else {
    const fallback = await supabase
      .from("assets")
      .select("size_bytes")
      .eq("organization_id", organizationId)
      .is("deleted_at", null);
    usedBytes = (fallback.data ?? []).reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0);
  }

  const ratio = limitBytes > 0 ? usedBytes / limitBytes : 0;
  const level: StorageLevel = ratio >= criticalRatio ? "critical" : ratio >= warnRatio ? "warn" : "ok";

  return {
    provider: "r2",
    configured: isR2Configured(),
    usedBytes,
    limitBytes,
    ratio,
    warnRatio,
    criticalRatio,
    level,
  };
}
