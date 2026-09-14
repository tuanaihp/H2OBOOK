import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { getAppMode, getRuntimeCapabilities, isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_VERSION } from "@/lib/version";

export type OperationsHealth = {
  mode: "production" | "demo";
  status: "ready" | "degraded";
  version: string;
  checkedAt: string;
  services: Array<{ key: string; label: string; status: "ok" | "missing" | "error" | "unconfigured"; required: boolean; description: string }>;
  database: "ok" | "error" | "unconfigured";
};

/**
 * Operations System Health (audit C-OPS): real capability/config status instead of hardcoded
 * "Sẵn sàng" cards. Adds a live database ping on top of the static capability matrix so a
 * configured-but-down Supabase shows as an error, not "ready".
 */
export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const capabilities = getRuntimeCapabilities();

  if (auth.user!.demo || !isSupabaseConfigured()) {
    return NextResponse.json({
      mode: "demo",
      status: "degraded",
      version: APP_VERSION,
      checkedAt: new Date().toISOString(),
      services: capabilities.map((item) => ({ key: item.key, label: item.label, status: item.configured ? "ok" : "missing", required: item.required, description: item.description })),
      database: "unconfigured"
    } satisfies OperationsHealth);
  }

  const access = await resolveOrganizationAccess(auth.user!, undefined, ["owner", "admin"]);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let database: OperationsHealth["database"] = "unconfigured";
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.from("organizations").select("id", { count: "exact", head: true }).limit(1);
    database = error ? "error" : "ok";
  }

  const services = capabilities.map((item) => ({
    key: item.key,
    label: item.label,
    status: item.key === "database" ? database : item.configured ? ("ok" as const) : ("missing" as const),
    required: item.required,
    description: item.description
  }));
  const degraded = services.some((item) => item.required && item.status !== "ok");

  return NextResponse.json({
    mode: "production",
    status: degraded ? "degraded" : "ready",
    version: APP_VERSION,
    checkedAt: new Date().toISOString(),
    services,
    database
  } satisfies OperationsHealth, { status: degraded && getAppMode() === "production" ? 200 : 200 });
}
