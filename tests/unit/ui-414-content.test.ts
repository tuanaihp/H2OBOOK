import { describe, expect, it } from "vitest";
import { learningPaths, membershipPlans, publicBooks, publicCourses, publicStrategies } from "@/lib/public-site/content";
import { getLocalMentorAnswer, studentCareerStages, studentSkills } from "@/lib/student/experience";

describe("H2OBOOK 4.14 public and student read models", () => {
  it("keeps all public catalog slugs unique", () => {
    for (const collection of [publicBooks, publicCourses, publicStrategies]) {
      const slugs = collection.map((item) => item.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("contains a complete public learning ecosystem", () => {
    expect(publicBooks.length).toBeGreaterThanOrEqual(6);
    expect(publicCourses.length).toBeGreaterThanOrEqual(6);
    expect(publicStrategies.length).toBeGreaterThanOrEqual(6);
    expect(learningPaths.length).toBe(5);
    expect(membershipPlans.some((plan) => plan.featured)).toBe(true);
  });

  it("keeps the student path and skill map actionable", () => {
    expect(studentCareerStages.some((stage) => stage.status === "active")).toBe(true);
    expect(studentSkills.some((skill) => skill.status === "practice")).toBe(true);
    expect(studentSkills.every((skill) => skill.progress >= 0 && skill.progress <= 100)).toBe(true);
  });

  it("returns deterministic local mentor guidance", () => {
    expect(getLocalMentorAnswer("Tôi nên học bài nào tiếp?")).toContain("bài 3.2");
    expect(getLocalMentorAnswer("Bài tập của tôi còn thiếu gì?")).toContain("2 bài makeup cô dâu");
  });
});
