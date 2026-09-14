"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOperationsStore } from "@/store/operations-store";
import type { ApprovalRequest, SupportTicket, TicketStatus } from "@/types/operations";
import type { OperationsHealth } from "@/app/api/operations/health/route";

type Mode = "loading" | "production" | "demo" | "error";

const productionApp = process.env.NEXT_PUBLIC_APP_MODE === "production";

async function readError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  return payload?.message ?? fallback;
}

/**
 * Shared loader for the Operations Center surfaces backed by real tables (audit C-OPS):
 * support_tickets and approval_requests. Same contract as useAdmissionLeads — production reads
 * and writes the real API, demo/local mode keeps the seeded store, and a production failure shows
 * an error instead of silently falling back to sample rows.
 */
function useOperationsCollection<T extends { id: string }>(endpoint: string, key: string, seedRows: T[]) {
  const [mode, setMode] = useState<Mode>("loading");
  const [liveRows, setLiveRows] = useState<T[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response, "Không tải được dữ liệu."));
      const payload = await response.json() as { mode: "production" | "demo" } & Record<string, unknown>;
      setLiveRows((payload[key] as T[] | undefined) ?? []);
      setMode(payload.mode === "production" ? "production" : "demo");
    } catch (loadError) {
      if (!productionApp) { setMode("demo"); return; }
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu.");
      setMode("error");
    }
  }, [endpoint, key]);

  useEffect(() => { void reload(); }, [reload]);

  const rows = useMemo(() => (mode === "demo" ? seedRows : liveRows), [mode, seedRows, liveRows]);
  const replaceRow = useCallback((next: T) => setLiveRows((current) => current.map((row) => (row.id === next.id ? next : row))), []);

  return { mode, rows, liveRows, error, busyId, setBusyId, reload, replaceRow };
}

export function useSupportTickets() {
  const seedTickets = useOperationsStore((state) => state.tickets);
  const seedUpdate = useOperationsStore((state) => state.updateTicketStatus);
  const collection = useOperationsCollection<SupportTicket>("/api/operations/tickets", "tickets", seedTickets);

  const updateStatus = useCallback(async (ticketId: string, status: TicketStatus) => {
    if (collection.mode === "demo") { seedUpdate(ticketId, status); return; }
    if (collection.busyId) return;
    const previous = collection.liveRows.find((ticket) => ticket.id === ticketId);
    if (!previous) return;
    collection.setBusyId(ticketId);
    collection.replaceRow({ ...previous, status });
    try {
      const response = await fetch(`/api/operations/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error(await readError(response, "Không cập nhật được yêu cầu hỗ trợ."));
      collection.replaceRow((await response.json() as { ticket: SupportTicket }).ticket);
    } catch (updateError) {
      collection.replaceRow(previous);
      throw updateError;
    } finally {
      collection.setBusyId(null);
    }
  }, [collection, seedUpdate]);

  return { ...collection, updateStatus };
}

export function useApprovalRequests() {
  const seedApprovals = useOperationsStore((state) => state.approvals);
  const seedDecide = useOperationsStore((state) => state.decideApproval);
  const collection = useOperationsCollection<ApprovalRequest>("/api/operations/approvals", "approvals", seedApprovals);

  const decide = useCallback(async (approvalId: string, decision: "approved" | "changes_requested" | "rejected") => {
    if (collection.mode === "demo") { seedDecide(approvalId, decision); return { ok: true as const }; }
    if (collection.busyId) return { ok: false as const, error: "BUSY" };
    const previous = collection.liveRows.find((approval) => approval.id === approvalId);
    if (!previous) return { ok: false as const, error: "NOT_FOUND" };
    collection.setBusyId(approvalId);
    collection.replaceRow({ ...previous, status: decision });
    try {
      const response = await fetch(`/api/operations/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision })
      });
      if (!response.ok) throw new Error(await readError(response, "Không ghi nhận được quyết định."));
      collection.replaceRow((await response.json() as { approval: ApprovalRequest }).approval);
      return { ok: true as const };
    } catch (decideError) {
      collection.replaceRow(previous);
      return { ok: false as const, error: decideError instanceof Error ? decideError.message : "Không ghi nhận được quyết định." };
    } finally {
      collection.setBusyId(null);
    }
  }, [collection, seedDecide]);

  return { ...collection, decide };
}

export type SubmissionQueueItem = {
  id: string; source: "legacy" | "brain"; title: string; studentId: string; studentName: string;
  status: string; submittedAt: string | null; dueAt: string | null; maxScore: number;
};

/** Real grading queue from /api/teaching/submissions (owner/admin see all classes). Returns an
 *  empty list — never seed data — when the queue can't be loaded, because a fake queue is worse
 *  than an honest empty one. */
export function useSubmissionQueue() {
  const [mode, setMode] = useState<Mode>("loading");
  const [submissions, setSubmissions] = useState<SubmissionQueueItem[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/teaching/submissions", { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response, "Không tải được hàng đợi chấm bài."));
      const payload = await response.json() as { submissions?: SubmissionQueueItem[] };
      setSubmissions(payload.submissions ?? []);
      setMode("production");
    } catch (loadError) {
      if (!productionApp) { setMode("demo"); setSubmissions([]); return; }
      setError(loadError instanceof Error ? loadError.message : "Không tải được hàng đợi chấm bài.");
      setMode("error");
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  const pending = useMemo(() => submissions.filter((item) => item.status === "submitted" || item.status === "reviewing"), [submissions]);
  return { mode, submissions, pending, error, reload };
}

export function useOperationsHealth() {
  const [health, setHealth] = useState<OperationsHealth | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/operations/health", { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response, "Không tải được trạng thái hệ thống."));
      setHealth(await response.json() as OperationsHealth);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được trạng thái hệ thống.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { health, error, loading, reload };
}
