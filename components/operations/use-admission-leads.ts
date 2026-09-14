"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOperationsStore } from "@/store/operations-store";
import { canInviteLead, type LiveAdmissionLead } from "@/lib/operations/admission-leads";
import type { LeadStage } from "@/types/operations";

type Mode = "loading" | "production" | "demo" | "error";

const productionApp = process.env.NEXT_PUBLIC_APP_MODE === "production";

async function readError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  return payload?.message ?? fallback;
}

/**
 * Admission leads for the Operations CRM (audit BUG-5). Production reads and writes the real
 * admission_leads table; demo/local mode keeps the seeded Zustand store. A production failure shows
 * an error instead of silently falling back to sample customers.
 */
export function useAdmissionLeads() {
  const seedLeads = useOperationsStore((state) => state.leads);
  const moveSeedLead = useOperationsStore((state) => state.moveLead);
  const [mode, setMode] = useState<Mode>("loading");
  const [liveLeads, setLiveLeads] = useState<LiveAdmissionLead[]>([]);
  const [error, setError] = useState("");
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/operations/leads", { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response, "Không tải được danh sách khách tuyển sinh."));
      const payload = await response.json() as { mode: "production" | "demo"; leads: LiveAdmissionLead[] };
      setLiveLeads(payload.leads ?? []);
      setMode(payload.mode === "production" ? "production" : "demo");
    } catch (loadError) {
      if (!productionApp) { setMode("demo"); return; }
      setError(loadError instanceof Error ? loadError.message : "Không tải được danh sách khách tuyển sinh.");
      setMode("error");
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const leads = useMemo<LiveAdmissionLead[]>(
    () => mode === "demo" ? seedLeads.map((lead) => ({ ...lead, canInvite: false })) : liveLeads,
    [mode, seedLeads, liveLeads]
  );

  const replaceLead = (next: LiveAdmissionLead) => setLiveLeads((current) => current.map((lead) => {
    if (lead.id !== next.id) return lead;
    const applicationId = next.applicationId ?? lead.applicationId;
    const applicationStatus = next.applicationStatus ?? lead.applicationStatus;
    const application = applicationId && applicationStatus ? { id: applicationId, status: applicationStatus } : undefined;
    return { ...next, applicationId, applicationStatus, canInvite: canInviteLead(next, application) };
  }));

  const moveLead = useCallback(async (leadId: string, stage: LeadStage) => {
    if (mode === "demo") { moveSeedLead(leadId, stage); return; }
    const previous = liveLeads.find((lead) => lead.id === leadId);
    if (!previous || busyLeadId) return;
    setError("");
    setBusyLeadId(leadId);
    replaceLead({ ...previous, stage });
    try {
      const response = await fetch(`/api/operations/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage })
      });
      if (!response.ok) throw new Error(await readError(response, "Không cập nhật được giai đoạn."));
      replaceLead((await response.json() as { lead: LiveAdmissionLead }).lead);
    } catch (moveError) {
      replaceLead(previous);
      setError(moveError instanceof Error ? moveError.message : "Không cập nhật được giai đoạn.");
    } finally {
      setBusyLeadId(null);
    }
  }, [mode, liveLeads, busyLeadId, moveSeedLead]);

  const inviteLead = useCallback(async (leadId: string) => {
    if (mode !== "production" || busyLeadId) return null;
    setError("");
    setBusyLeadId(leadId);
    try {
      const response = await fetch(`/api/operations/leads/${leadId}/invite`, { method: "POST" });
      if (!response.ok) throw new Error(await readError(response, "Không gửi được lời mời."));
      const payload = await response.json() as { lead: LiveAdmissionLead; invited: boolean; emailAccepted: boolean; via: "application" | "direct" };
      replaceLead(payload.lead);
      return payload;
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Không gửi được lời mời.");
      return null;
    } finally {
      setBusyLeadId(null);
    }
  }, [mode, busyLeadId]);

  return { mode, leads, error, busyLeadId, reload, moveLead, inviteLead };
}
