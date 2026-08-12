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
  it("returns real destinations for the real Stage 1 Missions that have them", () => {
    const destinations = getMissionOutputDestinations("Hoàn thiện hồ sơ Stage 1");
    expect(destinations.length).toBeGreaterThan(0);
    expect(destinations.some((d) => d.surface === "credential")).toBe(true);
  });

  it("returns an empty array for a Mission title with no mapped destination, rather than inventing one", () => {
    expect(getMissionOutputDestinations("Một Mission không tồn tại")).toEqual([]);
  });
});
