import { describe, expect, it } from "vitest";
import { canAccessOperationsArea, getDefaultRouteForRole } from "@/lib/operations/permissions";
import { operationsRouteManifest } from "@/lib/operations/routes";
import { seedAdmissionLeads, seedCertificates } from "@/lib/operations/data";

describe("operations foundation", () => {
  it("keeps role boundaries explicit", () => {
    expect(canAccessOperationsArea("teacher", "instructor")).toBe(true);
    expect(canAccessOperationsArea("teacher", "platform_admin")).toBe(false);
    expect(canAccessOperationsArea("platform_admin", "platform_admin")).toBe(true);
  });

  it("routes each role to the correct workspace", () => {
    expect(getDefaultRouteForRole("teacher")).toBe("/instructor");
    expect(getDefaultRouteForRole("admissions")).toBe("/operations");
    expect(getDefaultRouteForRole("student")).toBe("/student");
  });

  it("contains the required route spaces", () => {
    expect(operationsRouteManifest.customer.length).toBeGreaterThanOrEqual(4);
    expect(operationsRouteManifest.instructor.length).toBeGreaterThanOrEqual(4);
    expect(operationsRouteManifest.operations.length).toBeGreaterThanOrEqual(8);
    expect(operationsRouteManifest.platformAdmin.length).toBeGreaterThanOrEqual(4);
  });

  it("ships deterministic demo foundations", () => {
    expect(seedAdmissionLeads.some((lead) => lead.stage === "deposit")).toBe(true);
    expect(seedCertificates.every((certificate) => certificate.certificateNo.startsWith("H2O-"))).toBe(true);
  });
});
