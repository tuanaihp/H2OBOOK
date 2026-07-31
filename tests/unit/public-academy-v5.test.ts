import { describe, expect, it } from "vitest";
import { buildFallbackPublicAcademyViewModel } from "@/lib/public-academy-v5/fallback";

 describe("Public Academy V5 fallback", () => {
  it("normalizes public catalogs, learning paths and membership plans", () => {
    const model = buildFallbackPublicAcademyViewModel();
    expect(model.books.length).toBeGreaterThan(0);
    expect(model.courses.length).toBeGreaterThan(0);
    expect(model.strategies.length).toBeGreaterThan(0);
    expect(model.learningPaths).toHaveLength(5);
    expect(model.membershipPlans).toHaveLength(3);
  });

  it("keeps every catalog route inside public academy", () => {
    const model = buildFallbackPublicAcademyViewModel();
    for (const item of [...model.books, ...model.courses, ...model.strategies]) {
      expect(item.href.startsWith("/academy/")).toBe(true);
    }
  });

  it("provides six public page title contracts", () => {
    const pages = Object.keys(buildFallbackPublicAcademyViewModel().config.pageTitles);
    expect(pages.sort()).toEqual(["about", "books", "courses", "learning-paths", "membership", "strategies"].sort());
  });

  it("keeps AI optional in membership and auth messaging", () => {
    const model = buildFallbackPublicAcademyViewModel();
    expect(model.config.membership.privacyDescription).toContain("AI tắt");
    expect(model.config.auth.trustDescription).toContain("RLS");
  });
});
