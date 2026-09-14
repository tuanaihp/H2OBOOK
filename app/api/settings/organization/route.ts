import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/runtime-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  invalidSettingsMessage,
  isMissingTableError,
  sanitizeSmartSettings,
  sanitizeWorkspaceSettings,
  type OrganizationSettingsPayload
} from "@/lib/settings/organization-settings";

const COLUMNS = "workspace,smart_settings,updated_at";
const demoPayload: OrganizationSettingsPayload = { mode: "demo", workspace: {}, smartSettings: {}, updatedAt: null };
const notMigrated = () => NextResponse.json({ error: "SETTINGS_NOT_MIGRATED", message: "Máy chủ chưa có bảng cài đặt (migration 0073). Thay đổi mới chỉ được lưu trên trình duyệt này.", retryable: false }, { status: 503 });

type SettingsRow = { workspace: unknown; smart_settings: unknown; updated_at: string | null };

function toPayload(row: SettingsRow | null): OrganizationSettingsPayload {
  return {
    mode: "production",
    workspace: sanitizeWorkspaceSettings(row?.workspace).value,
    smartSettings: sanitizeSmartSettings(row?.smart_settings).value,
    updatedAt: row?.updated_at ?? null
  };
}

// Same organization resolution as /api/sync/*: the client sends its workspace id, a non-UUID
// falls back to the caller's first active owner/admin membership.
async function authorize(requestedOrganizationId?: string) {
  const auth = await requireApiUser();
  if (auth.response) return { response: auth.response };
  if (auth.user!.demo || !isSupabaseConfigured()) return { response: NextResponse.json(demoPayload) };
  const access = await resolveOrganizationAccess(auth.user!, requestedOrganizationId, ["owner", "admin"]);
  if (!access) return { response: NextResponse.json({ error: "FORBIDDEN", message: "Chỉ chủ sở hữu hoặc quản trị viên được thay đổi cài đặt." }, { status: 403 }) };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { response: NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 }) };
  return { user: auth.user!, organizationId: access.organizationId, supabase };
}

export async function GET(request: Request) {
  const context = await authorize(new URL(request.url).searchParams.get("organizationId") ?? undefined);
  if (context.response) return context.response;
  const { data, error } = await context.supabase.from("organization_settings").select(COLUMNS).eq("organization_id", context.organizationId).maybeSingle();
  if (isMissingTableError(error)) return notMigrated();
  if (error) return NextResponse.json({ error: "SETTINGS_LOAD_FAILED", retryable: true }, { status: 500 });
  return NextResponse.json(toPayload(data as SettingsRow | null));
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as { organizationId?: string; workspace?: unknown; smartSettings?: unknown } | null;
  if (!body) return NextResponse.json({ error: "VALID_JSON_REQUIRED" }, { status: 400 });
  const workspace = sanitizeWorkspaceSettings(body.workspace);
  const smart = sanitizeSmartSettings(body.smartSettings);
  const invalid = [...workspace.invalid, ...smart.invalid];
  if (invalid.length) return NextResponse.json({ error: "INVALID_SETTINGS", message: invalidSettingsMessage(invalid), details: { fields: invalid } }, { status: 400 });

  const context = await authorize(body.organizationId);
  if (context.response) return context.response;
  const { data: existing, error: loadError } = await context.supabase.from("organization_settings").select(COLUMNS).eq("organization_id", context.organizationId).maybeSingle();
  if (isMissingTableError(loadError)) return notMigrated();
  if (loadError) return NextResponse.json({ error: "SETTINGS_LOAD_FAILED", retryable: true }, { status: 500 });

  // Merge field by field so saving /smart-settings never clears /settings and vice versa.
  const current = toPayload(existing as SettingsRow | null);
  const { data, error } = await context.supabase
    .from("organization_settings")
    .upsert({
      organization_id: context.organizationId,
      workspace: { ...current.workspace, ...workspace.value },
      smart_settings: { ...current.smartSettings, ...smart.value },
      updated_by: context.user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: "organization_id" })
    .select(COLUMNS)
    .single();
  if (isMissingTableError(error)) return notMigrated();
  if (error) return NextResponse.json({ error: "SETTINGS_SAVE_FAILED", message: "Không lưu được cài đặt lên máy chủ.", retryable: true }, { status: 500 });
  return NextResponse.json(toPayload(data as SettingsRow));
}
