"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  seedAdmissionLeads, seedApplications, seedApprovals, seedAssessmentTasks, seedAutomationRecipes,
  seedImportJobs, seedInstructorClasses, seedNotificationTemplates, seedOrganizations, seedSupportTickets
} from "@/lib/operations/data";
import type {
  AdmissionLead, ApprovalRequest, CustomerApplication, DataImportJob, ImportStatus, LeadStage,
  PlatformOrganization, SupportTicket, TicketStatus
} from "@/types/operations";

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

type OperationsState = {
  leads: AdmissionLead[];
  applications: CustomerApplication[];
  instructorClasses: typeof seedInstructorClasses;
  assessmentTasks: typeof seedAssessmentTasks;
  tickets: SupportTicket[];
  approvals: ApprovalRequest[];
  notificationTemplates: typeof seedNotificationTemplates;
  importJobs: DataImportJob[];
  automations: typeof seedAutomationRecipes;
  organizations: PlatformOrganization[];
  moveLead: (leadId: string, stage: LeadStage) => void;
  addLeadNote: (leadId: string, note: string) => void;
  provisionCustomerAccount: (applicationId: string) => void;
  createTicket: (input: Pick<SupportTicket, "requesterName" | "requesterType" | "category" | "subject" | "description" | "priority">) => SupportTicket;
  updateTicketStatus: (ticketId: string, status: TicketStatus) => void;
  decideApproval: (approvalId: string, status: "approved" | "changes_requested" | "rejected") => void;
  toggleNotificationTemplate: (templateId: string) => void;
  createImportJob: (input: Pick<DataImportJob, "type" | "fileName" | "rowCount">) => DataImportJob;
  updateImportStatus: (jobId: string, status: ImportStatus) => void;
  toggleAutomation: (automationId: string) => void;
  resetOperationsDemo: () => void;
};

const initialState = () => ({
  leads: structuredClone(seedAdmissionLeads),
  applications: structuredClone(seedApplications),
  instructorClasses: structuredClone(seedInstructorClasses),
  assessmentTasks: structuredClone(seedAssessmentTasks),
  tickets: structuredClone(seedSupportTickets),
  approvals: structuredClone(seedApprovals),
  notificationTemplates: structuredClone(seedNotificationTemplates),
  importJobs: structuredClone(seedImportJobs),
  automations: structuredClone(seedAutomationRecipes),
  organizations: structuredClone(seedOrganizations)
});

export const useOperationsStore = create<OperationsState>()(
  persist(
    (set, get) => ({
      ...initialState(),
      moveLead: (leadId, stage) => set((state) => ({ leads: state.leads.map((lead) => lead.id === leadId ? { ...lead, stage, updatedAt: new Date().toISOString() } : lead) })),
      addLeadNote: (leadId, note) => set((state) => ({ leads: state.leads.map((lead) => lead.id === leadId ? { ...lead, notes: [lead.notes, note.trim()].filter(Boolean).join("\n"), updatedAt: new Date().toISOString() } : lead) })),
      provisionCustomerAccount: (applicationId) => set((state) => ({ applications: state.applications.map((item) => item.id === applicationId ? { ...item, accountProvisioned: true, onboardingStage: "completed", profileCompletion: 100, updatedAt: new Date().toISOString() } : item) })),
      createTicket: (input) => {
        const ticket: SupportTicket = { id: uid("ticket"), code: `H2O-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${String(get().tickets.length + 1).padStart(3, "0")}`, ...input, status: "open", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        set((state) => ({ tickets: [ticket, ...state.tickets] }));
        return ticket;
      },
      updateTicketStatus: (ticketId, status) => set((state) => ({ tickets: state.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, status, updatedAt: new Date().toISOString() } : ticket) })),
      decideApproval: (approvalId, status) => set((state) => ({ approvals: state.approvals.map((approval) => approval.id === approvalId ? { ...approval, status, updatedAt: new Date().toISOString() } : approval) })),
      toggleNotificationTemplate: (templateId) => set((state) => ({ notificationTemplates: state.notificationTemplates.map((item) => item.id === templateId ? { ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() } : item) })),
      createImportJob: (input) => {
        const job: DataImportJob = { id: uid("import"), ...input, validRows: 0, invalidRows: 0, status: "draft", createdBy: "Current User", createdAt: new Date().toISOString(), rollbackAvailable: false };
        set((state) => ({ importJobs: [job, ...state.importJobs] }));
        return job;
      },
      updateImportStatus: (jobId, status) => set((state) => ({ importJobs: state.importJobs.map((job) => job.id === jobId ? { ...job, status, rollbackAvailable: status === "completed" } : job) })),
      toggleAutomation: (automationId) => set((state) => ({ automations: state.automations.map((automation) => automation.id === automationId ? { ...automation, status: automation.status === "active" ? "paused" : "active" } : automation) })),
      resetOperationsDemo: () => set(initialState())
    }),
    { name: "h2obook-operations-foundation-v1", version: 1 }
  )
);
