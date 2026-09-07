import { describe, expect, it } from "vitest";
import { getVietnamHolidaySuggestions } from "@/lib/teaching/vietnam-holiday-suggestions";

describe("Vietnam holiday suggestions", () => {
  it("creates statutory and lunar suggestions for 2026 in calendar order", () => {
    const items = getVietnamHolidaySuggestions(2026);
    expect(items.map((item) => item.date)).toContain("2026-02-17");
    expect(items.map((item) => item.date)).toContain("2026-04-26");
    expect(items.map((item) => item.date)).toContain("2026-09-02");
    expect(items.map((item) => item.date)).toEqual([...items.map((item) => item.date)].sort());
  });

  it("rejects years outside the supported range", () => {
    expect(getVietnamHolidaySuggestions(1800)).toEqual([]);
  });
});
