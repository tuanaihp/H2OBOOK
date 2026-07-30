import { describe, expect, it } from "vitest";
import { buildCourseModules, catalogProductSlug, getAcademyTarget } from "@/lib/academy/catalog";

describe("Academy revenue loop catalog", () => {
  it("turns every public course into a complete lesson curriculum", () => {
    const course = getAcademyTarget("course", "makeup-chuyen-nghiep-3-thang");
    expect(course).toBeTruthy();
    const modules = buildCourseModules(course!.slug);
    expect(modules).toHaveLength(course!.modules.length);
    expect(modules.flatMap((module) => module.lessons)).toHaveLength(course!.lessons);
    expect(new Set(modules.flatMap((module) => module.lessons.map((lesson) => lesson.slug))).size).toBe(course!.lessons);
  });

  it("maps lessons to the canonical Skill Map keys", () => {
    const lessons = buildCourseModules("makeup-chuyen-nghiep-3-thang").flatMap((module) => module.lessons);
    const allowed = new Set(["skin", "face", "bridal", "waves", "updo", "consult", "team", "pricing", "brand"]);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((lesson) => lesson.skillKeys.every((key) => allowed.has(key)))).toBe(true);
  });

  it("keeps course and membership product slugs in separate namespaces", () => {
    expect(catalogProductSlug("course", "academy")).toBe("course-academy");
    expect(catalogProductSlug("membership", "academy")).toBe("membership-academy");
  });
});
