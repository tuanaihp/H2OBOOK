import type { SmartAssistMode, SmartSettings, Workspace } from "@/types/domain";

/**
 * Organization settings (audit BUG-4): the subset of `Workspace` and `SmartSettings` an owner/admin
 * may edit and that the server stores in public.organization_settings. `id`, `plan` and the storage
 * quota are intentionally absent — they are server/billing facts and silently dropped if sent.
 */
export type EditableWorkspaceSettings = Pick<Workspace, "name" | "slug" | "ownerName" | "email" | "phone" | "brandColor"> & {
  customDomain?: string;
  logoUrl?: string;
};

export type OrganizationSettingsPayload = {
  mode: "production" | "demo";
  workspace: Partial<EditableWorkspaceSettings>;
  smartSettings: Partial<SmartSettings>;
  updatedAt: string | null;
};

type Validator = (value: unknown) => { ok: true; value: unknown } | { ok: false };
type Sanitized<T> = { value: Partial<T>; invalid: string[] };

const ok = (value: unknown) => ({ ok: true as const, value });
const fail = { ok: false as const };

const text = (max: number, { required = false } = {}): Validator => (value) => {
  if (typeof value !== "string") return fail;
  const trimmed = value.trim();
  if (required && !trimmed) return fail;
  return trimmed.length > max ? fail : ok(trimmed);
};

const pattern = (regex: RegExp, max: number, { optional = false, lower = false } = {}): Validator => (value) => {
  if (typeof value !== "string") return fail;
  let trimmed = value.trim();
  if (lower) trimmed = trimmed.toLowerCase();
  if (!trimmed) return optional ? ok("") : fail;
  return trimmed.length <= max && regex.test(trimmed) ? ok(trimmed) : fail;
};

const httpsUrl: Validator = (value) => {
  if (typeof value !== "string") return fail;
  const trimmed = value.trim();
  if (!trimmed) return ok("");
  if (trimmed.length > 2048) return fail;
  try {
    return new URL(trimmed).protocol === "https:" ? ok(trimmed) : fail;
  } catch {
    return fail;
  }
};

const bool: Validator = (value) => (typeof value === "boolean" ? ok(value) : fail);
const ASSIST_MODES: readonly SmartAssistMode[] = ["local", "external", "off"];
const assistMode: Validator = (value) => (typeof value === "string" && (ASSIST_MODES as readonly string[]).includes(value) ? ok(value) : fail);

const WORKSPACE_VALIDATORS: Record<keyof EditableWorkspaceSettings, Validator> = {
  name: text(120, { required: true }),
  slug: pattern(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, 64, { lower: true }),
  ownerName: text(120),
  email: pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 254, { optional: true, lower: true }),
  phone: pattern(/^[0-9+().\s-]{3,30}$/, 30, { optional: true }),
  brandColor: pattern(/^#[0-9a-f]{6}$/i, 7),
  customDomain: pattern(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, 253, { optional: true, lower: true }),
  logoUrl: httpsUrl
};

const SMART_VALIDATORS: Record<keyof SmartSettings, Validator> = {
  aiEnabled: bool,
  assistMode,
  offlineFirst: bool,
  autoGenerateStudyCards: bool,
  reduceMotion: bool,
  highContrast: bool,
  focusMode: bool
};

export const WORKSPACE_FIELD_LABELS: Record<keyof EditableWorkspaceSettings, string> = {
  name: "Tên workspace",
  slug: "Slug",
  ownerName: "Chủ sở hữu",
  email: "Email quản trị",
  phone: "Điện thoại",
  brandColor: "Màu hệ thống",
  customDomain: "Tên miền riêng",
  logoUrl: "Logo"
};

function sanitize<T>(input: unknown, validators: Record<string, Validator>): Sanitized<T> {
  const value: Record<string, unknown> = {};
  const invalid: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { value: {}, invalid: [] };
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const validate = validators[key];
    if (!validate || raw === undefined) continue;
    const result = validate(raw);
    if (result.ok) value[key] = result.value;
    else invalid.push(key);
  }
  return { value: value as Partial<T>, invalid };
}

/** Keeps editable, valid fields; lists invalid editable fields; ignores everything else. */
export function sanitizeWorkspaceSettings(input: unknown): Sanitized<EditableWorkspaceSettings> {
  return sanitize<EditableWorkspaceSettings>(input, WORKSPACE_VALIDATORS);
}

export function sanitizeSmartSettings(input: unknown): Sanitized<SmartSettings> {
  return sanitize<SmartSettings>(input, SMART_VALIDATORS);
}

export function invalidSettingsMessage(fields: string[]) {
  const labels = fields.map((field) => WORKSPACE_FIELD_LABELS[field as keyof EditableWorkspaceSettings] ?? field);
  return `Giá trị không hợp lệ: ${labels.join(", ")}.`;
}

/** The migration has not been applied yet (Postgres 42P01 or PostgREST schema-cache miss). */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /organization_settings/.test(error.message ?? "") && /does not exist|schema cache/i.test(error.message ?? "");
}
