import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inputErrorResponse } from "@/lib/input/api-errors";
import { inputLog, resolveInputTraceId } from "@/lib/observability/input-observability";
import { clampInteger } from "@/lib/security/request-limits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || supplied !== expected) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const traceId = resolveInputTraceId(request);
  try {
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
    const limit = clampInteger(new URL(request.url).searchParams.get("limit"), 1, 500, 100);
    const { data, error } = await admin.rpc("recover_stale_input_sessions", { p_limit: limit });
    if (error) throw error;
    const recovered = Array.isArray(data) ? data.length : 0;
    inputLog("info", { event: "input.recovery.sweep", traceId, metrics: { recovered, limit } });
    return NextResponse.json({ ok: true, recovered, sessions: data ?? [], traceId }, { headers: { "x-trace-id": traceId } });
  } catch (error) { return inputErrorResponse(error, request, "INPUT_RECOVERY_SWEEP_FAILED"); }
}
