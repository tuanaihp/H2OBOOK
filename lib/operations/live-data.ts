import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalRequest, SupportTicket, TicketStatus } from "@/types/operations";

/**
 * Live reads/writes for the Operations Center surfaces that still have a real backing table
 * (migration 0025): support_tickets and approval_requests. Everything here is org-scoped and
 * expects to run under the caller's RLS-bound client — the "staff manage" policies are the second
 * authorization boundary after resolveOrganizationAccess.
 */

export const SUPPORT_TICKET_COLUMNS =
  "id,code,requester_name,requester_type,category,subject,description,priority,status,assignee_id,created_at,updated_at";

export const APPROVAL_REQUEST_COLUMNS =
  "id,request_type,title,resource_type,resource_id,requester_id,reviewer_id,status,risk_level,decision_note,due_at,created_at,updated_at";

const TICKET_STATUSES: readonly TicketStatus[] = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}

export const APPROVAL_DECISIONS = ["approved", "changes_requested", "rejected"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
export function isApprovalDecision(value: unknown): value is ApprovalDecision {
  return typeof value === "string" && (APPROVAL_DECISIONS as readonly string[]).includes(value);
}

type NameMap = Map<string, string>;

/** assignee/requester/reviewer ids point at auth.users; profiles is global (no org column), so
 *  names are loaded through organization_members to keep the lookup inside the org boundary. */
async function loadProfileNames(client: SupabaseClient, organizationId: string, userIds: string[]): Promise<NameMap> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await client
    .from("organization_members")
    .select("user_id,profiles!inner(id,full_name)")
    .eq("organization_id", organizationId)
    .in("user_id", ids);
  const map: NameMap = new Map();
  for (const row of data ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (profile) map.set(String(row.user_id), String((profile as { full_name?: string }).full_name ?? ""));
  }
  return map;
}

export function mapSupportTicketRow(row: Record<string, unknown>, names: NameMap): SupportTicket {
  const assigneeId = row.assignee_id ? String(row.assignee_id) : null;
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    requesterName: String(row.requester_name ?? "—"),
    requesterType: (row.requester_type as SupportTicket["requesterType"]) ?? "staff",
    category: (row.category as SupportTicket["category"]) ?? "technical",
    subject: String(row.subject ?? ""),
    description: String(row.description ?? ""),
    priority: (row.priority as SupportTicket["priority"]) ?? "normal",
    status: (row.status as TicketStatus) ?? "open",
    assigneeName: assigneeId ? names.get(assigneeId) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}

export function mapApprovalRequestRow(row: Record<string, unknown>, names: NameMap): ApprovalRequest {
  const requesterId = row.requester_id ? String(row.requester_id) : null;
  const reviewerId = row.reviewer_id ? String(row.reviewer_id) : null;
  return {
    id: String(row.id),
    type: (row.request_type as ApprovalRequest["type"]) ?? "book",
    title: String(row.title ?? ""),
    requesterName: (requesterId && names.get(requesterId)) || "—",
    reviewerName: reviewerId ? names.get(reviewerId) : undefined,
    status: (row.status as ApprovalRequest["status"]) ?? "pending",
    dueAt: row.due_at ? String(row.due_at) : undefined,
    riskLevel: (row.risk_level as ApprovalRequest["riskLevel"]) ?? "low",
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? "")
  };
}

export async function listSupportTickets(client: SupabaseClient, organizationId: string): Promise<SupportTicket[]> {
  const { data, error } = await client
    .from("support_tickets")
    .select(SUPPORT_TICKET_COLUMNS)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const names = await loadProfileNames(client, organizationId, (data ?? []).map((row) => String(row.assignee_id ?? "")));
  return (data ?? []).map((row) => mapSupportTicketRow(row as Record<string, unknown>, names));
}

export async function updateSupportTicketStatus(
  client: SupabaseClient,
  organizationId: string,
  ticketId: string,
  status: TicketStatus,
  assigneeId?: string | null
): Promise<SupportTicket | null> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (assigneeId !== undefined) patch.assignee_id = assigneeId;
  const { data, error } = await client
    .from("support_tickets")
    .update(patch)
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .select(SUPPORT_TICKET_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const names = await loadProfileNames(client, organizationId, [String(data.assignee_id ?? "")]);
  return mapSupportTicketRow(data as Record<string, unknown>, names);
}

export async function listApprovalRequests(client: SupabaseClient, organizationId: string): Promise<ApprovalRequest[]> {
  const { data, error } = await client
    .from("approval_requests")
    .select(APPROVAL_REQUEST_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const ids = (data ?? []).flatMap((row) => [String(row.requester_id ?? ""), String(row.reviewer_id ?? "")]);
  const names = await loadProfileNames(client, organizationId, ids);
  return (data ?? []).map((row) => mapApprovalRequestRow(row as Record<string, unknown>, names));
}

export async function decideApprovalRequest(
  client: SupabaseClient,
  organizationId: string,
  approvalId: string,
  decision: ApprovalDecision,
  reviewerId: string,
  decisionNote?: string
): Promise<ApprovalRequest | null> {
  const patch: Record<string, unknown> = {
    status: decision,
    reviewer_id: reviewerId,
    updated_at: new Date().toISOString()
  };
  if (typeof decisionNote === "string") patch.decision_note = decisionNote.slice(0, 2000);
  const { data, error } = await client
    .from("approval_requests")
    .update(patch)
    .eq("id", approvalId)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .select(APPROVAL_REQUEST_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const names = await loadProfileNames(client, organizationId, [String(data.requester_id ?? ""), String(data.reviewer_id ?? "")]);
  return mapApprovalRequestRow(data as Record<string, unknown>, names);
}
