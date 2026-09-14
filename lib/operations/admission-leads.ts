import type { AdmissionLead, LeadStage } from "@/types/operations";

export const LEAD_STAGES: readonly LeadStage[] = ["new", "contacted", "consulted", "qualified", "deposit", "paid", "enrolled", "lost"];

/** academy_applications statuses that approveAcademyApplication still accepts. */
const APPROVABLE_APPLICATION_STATUSES = new Set(["new", "approved"]);
/** The application already produced a student account; inviting again would only duplicate mail. */
const PROVISIONED_APPLICATION_STATUSES = new Set(["invited", "converted"]);
const NOTE_MAX_LENGTH = 2000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ADMISSION_LEAD_COLUMNS = "id,name,phone,email,source,interest,stage,next_action_at,expected_value,notes,tags,created_at,updated_at";

export type AdmissionLeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  interest: string | null;
  stage: string;
  next_action_at: string | null;
  expected_value: number | string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export type LinkedApplication = { id: string; status: string };

/** A CRM lead as the Operations UI sees it, plus what the "Duyệt → gửi invite" action needs. */
export type LiveAdmissionLead = AdmissionLead & {
  applicationId?: string;
  applicationStatus?: string;
  canInvite: boolean;
};

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && (LEAD_STAGES as readonly string[]).includes(value);
}

export function normalizeLeadEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function isValidLeadEmail(email: string | null | undefined) {
  return emailPattern.test(normalizeLeadEmail(email));
}

/**
 * Inviting needs an email and a lead that is still open. A pending application is approved through
 * the academy flow; a rejected one (or none) gets a direct invite; an already provisioned one is done.
 */
export function canInviteLead(lead: { email: string; stage: LeadStage }, application?: LinkedApplication) {
  if (!isValidLeadEmail(lead.email)) return false;
  if (lead.stage === "enrolled" || lead.stage === "lost") return false;
  return !application || !PROVISIONED_APPLICATION_STATUSES.has(application.status);
}

export function isProvisionedApplication(application?: LinkedApplication | null) {
  return Boolean(application && PROVISIONED_APPLICATION_STATUSES.has(application.status));
}

export function isApprovableApplication(application?: LinkedApplication | null): application is LinkedApplication {
  return Boolean(application && APPROVABLE_APPLICATION_STATUSES.has(application.status));
}

export function mapAdmissionLeadRow(row: AdmissionLeadRow, application?: LinkedApplication): LiveAdmissionLead {
  const stage = isLeadStage(row.stage) ? row.stage : "new";
  const lead: AdmissionLead = {
    id: String(row.id),
    name: row.name ?? "",
    phone: row.phone ?? "",
    email: normalizeLeadEmail(row.email),
    source: row.source ?? "manual",
    interest: row.interest ?? "",
    stage,
    ownerName: "",
    nextActionAt: row.next_action_at ?? undefined,
    expectedValue: Number(row.expected_value ?? 0) || 0,
    notes: row.notes ?? "",
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  return {
    ...lead,
    applicationId: application?.id,
    applicationStatus: application?.status,
    canInvite: canInviteLead(lead, application)
  };
}

/** Latest application per email; rows must arrive newest first. */
export function indexApplicationsByEmail(rows: Array<{ id: string; email: string | null; status: string }>) {
  const byEmail = new Map<string, LinkedApplication>();
  for (const row of rows) {
    const email = normalizeLeadEmail(row.email);
    if (email && !byEmail.has(email)) byEmail.set(email, { id: String(row.id), status: String(row.status) });
  }
  return byEmail;
}

/** Returns the trimmed note, "" for nothing to add, or null when it is too long. */
export function sanitizeLeadNote(note: unknown): string | null {
  if (note == null) return "";
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed.length > NOTE_MAX_LENGTH ? null : trimmed;
}

export function appendLeadNote(existing: string | null | undefined, note: string) {
  return [existing?.trim(), note].filter(Boolean).join("\n");
}
