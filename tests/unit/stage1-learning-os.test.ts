import { describe, expect, it } from "vitest";
import { generateCertificateNo } from "@/lib/stage1-learning-os/certificate-number";
import { getMissionOutputDestinations } from "@/lib/stage1-learning-os/output-reuse";

describe("generateCertificateNo", () => {
  it("builds a readable, stable-format certificate number from the Stage slug", () => {
    const no = generateCertificateNo("h2o-stage-01-foundation", 7);
    expect(no).toMatch(/^H2O-[A-Z0-9]{1,4}-\d{4}-0007$/);
  });

  it("pads the sequence to 4 digits", () => {
    expect(generateCertificateNo("foundation", 1)).toContain("-0001");
    expect(generateCertificateNo("foundation", 1234)).toContain("-1234");
  });

  it("falls back to STG1 when the slug has no alphanumeric characters", () => {
    expect(generateCertificateNo("---", 1)).toContain("H2O-STG1-");
  });
});

describe("getMissionOutputDestinations (§Mission Workspace Kết quả này sẽ được dùng ở đâu?)", () => {
  // Keyed by root_mission_id (migration 0054), not title — see lib/stage1-learning-os/output-reuse.ts's
  // comment for why: a title-keyed map broke silently when the 2026-08-13 Blueprint Transformation
  // renamed several real Missions on the newly-published version.
  it("returns real destinations for the real Stage 1 Missions that have them", () => {
    const destinations = getMissionOutputDestinations("16ee3dcf-2ee9-4c7f-92ef-1ef4f2ce6f8c"); // Hoàn thiện hồ sơ Stage 1 / Đánh giá cuối khóa
    expect(destinations.length).toBeGreaterThan(0);
    expect(destinations.some((d) => d.surface === "credential")).toBe(true);
  });

  it("returns an empty array for a root_mission_id with no mapped destination, rather than inventing one", () => {
    expect(getMissionOutputDestinations("00000000-0000-0000-0000-000000000000")).toEqual([]);
  });
});
