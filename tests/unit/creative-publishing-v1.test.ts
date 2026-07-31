import { describe, expect, it } from "vitest";
import { mergeSmartFields, parseCreativeCsv } from "@/lib/creative-publishing-v1/bulk";
import { creativeSurfaceRegistry, isCreativeSurface } from "@/lib/creative-publishing-v1/registry";

describe("Creative Publishing Operations V1", () => {
  it("keeps twelve ordered surfaces", () => {
    expect(creativeSurfaceRegistry).toHaveLength(12);
    expect(creativeSurfaceRegistry.map((item) => item.stage)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(isCreativeSurface("publish")).toBe(true);
    expect(isCreativeSurface("unknown")).toBe(false);
  });

  it("parses quoted CSV", () => {
    const rows = parseCreativeCsv('title,studentName\n"Bằng, nâng cao","Nguyễn Minh Anh"');
    expect(rows).toEqual([{ title: "Bằng, nâng cao", studentName: "Nguyễn Minh Anh" }]);
  });

  it("merges smart fields", () => {
    expect(mergeSmartFields("Chào {{ studentName }} — {{certificateNo}}", { studentName: "Minh Anh", certificateNo: "H2O-001" })).toBe("Chào Minh Anh — H2O-001");
  });
});
