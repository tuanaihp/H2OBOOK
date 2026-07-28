import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveInputTraceId } from "@/lib/observability/input-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const traceId = resolveInputTraceId(request);
  const checks: Record<string, { status: "ok" | "degraded" | "missing"; latencyMs?: number }> = {};
  const started = performance.now();
  const admin = createSupabaseAdminClient();
  if (!admin) checks.database = { status: "missing" };
  else {
    const before = performance.now();
    const { error } = await admin.from("input_sessions").select("id", { head: true, count: "exact" }).limit(1);
    checks.database = { status: error ? "degraded" : "ok", latencyMs: Math.round(performance.now() - before) };
  }
  checks.redis = { status: process.env.REDIS_URL ? "ok" : "missing" };
  checks.processor = { status: process.env.DOCUMENT_WORKER_URL && process.env.DOCUMENT_WORKER_SECRET ? "ok" : "missing" };
  checks.scanner = { status: process.env.FILE_SCAN_URL ? "ok" : "missing" };
  checks.storage = { status: process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET ? "ok" : "missing" };
  const status = Object.values(checks).some((item) => item.status === "degraded") ? "degraded" : Object.values(checks).some((item) => item.status === "missing") ? "partial" : "ok";
  return NextResponse.json({ status, version: "4.13.7", checks, durationMs: Math.round(performance.now() - started), traceId }, { status: status === "degraded" ? 503 : 200, headers: { "cache-control": "no-store", "x-trace-id": traceId } });
}
