import { describe, expect, it } from "vitest";
import { systemSurfaceRegistry } from "@/lib/system-governance-ops-v2/registry";
import {
  admissionLeads,
  approvalRequests,
  automationWorkflows,
  importBatches,
  notificationTemplates,
  operationsHealthServices,
  productConfigurationItems,
  runtimeServices,
  securityControls,
  supportTickets,
} from "@/lib/system-governance-ops-v2/data";

describe("system governance and operations v2", () => {
  it("registers nineteen unique surfaces", () => {
    expect(systemSurfaceRegistry).toHaveLength(19);
    expect(new Set(systemSurfaceRegistry.map((item) => item.id)).size).toBe(19);
    expect(systemSurfaceRegistry.filter((item) => item.group === "operations")).toHaveLength(9);
  });

  it("keeps AI gateway optional and core independent", () => {
    expect(runtimeServices.find((item) => item.id === "ai")?.required).toBe(false);
  });

  it("defines governance controls", () => {
    expect(securityControls.length).toBeGreaterThanOrEqual(6);
  });

  it("defines the complete operations control plane demo contract", () => {
    expect(admissionLeads.length).toBeGreaterThan(0);
    expect(approvalRequests.length).toBeGreaterThan(0);
    expect(automationWorkflows.length).toBeGreaterThan(0);
    expect(importBatches.length).toBeGreaterThan(0);
    expect(notificationTemplates.length).toBeGreaterThan(0);
    expect(productConfigurationItems.length).toBeGreaterThan(0);
    expect(supportTickets.length).toBeGreaterThan(0);
    expect(operationsHealthServices.length).toBeGreaterThan(0);
  });
});
