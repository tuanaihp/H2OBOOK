import { describe, expect, it } from "vitest";
import { isStageResourceAccess, isStageResourceType, isStageStatus, stageDisplayRank, toStageSlug, STAGE_RESOURCE_TYPES } from "@/lib/career-stages/types";

describe("toStageSlug", () => {
  it("turns a Vietnamese stage name into a URL- and constraint-safe slug", () => {
    expect(toStageSlug("Người mới bắt đầu")).toBe("nguoi-moi-bat-dau");
    expect(toStageSlug("Makeup Artist chuyên nghiệp")).toBe("makeup-artist-chuyen-nghiep");
    expect(toStageSlug("Studio / Học viện")).toBe("studio-hoc-vien");
  });

  it("handles đ and Đ, which NFD decomposition does not strip", () => {
    expect(toStageSlug("Đào tạo đội nhóm")).toBe("dao-tao-doi-nhom");
  });

  it("collapses punctuation runs and never leaves a leading or trailing dash", () => {
    expect(toStageSlug("  --- Giai đoạn 6!!!  ")).toBe("giai-doan-6");
    expect(toStageSlug("A & B  —  C")).toBe("a-b-c");
  });

  it("returns an empty string for input with nothing sluggable, so callers can reject it", () => {
    expect(toStageSlug("!!!")).toBe("");
    expect(toStageSlug("   ")).toBe("");
  });

  it("stays within the column's practical length", () => {
    expect(toStageSlug("x".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe("stage enum guards", () => {
  it("accepts every declared resource type and rejects anything else", () => {
    for (const type of STAGE_RESOURCE_TYPES) expect(isStageResourceType(type)).toBe(true);
    expect(isStageResourceType("ebook")).toBe(false);
    expect(isStageResourceType(undefined)).toBe(false);
    expect(isStageResourceType(null)).toBe(false);
    expect(isStageResourceType(1)).toBe(false);
  });

  it("guards access values, which map onto a database check constraint", () => {
    expect(isStageResourceAccess("free_preview")).toBe(true);
    expect(isStageResourceAccess("stage_locked")).toBe(true);
    expect(isStageResourceAccess("entitlement_only")).toBe(true);
    expect(isStageResourceAccess("free")).toBe(false);
  });

  it("guards status values", () => {
    expect(isStageStatus("active")).toBe(true);
    expect(isStageStatus("hidden")).toBe(true);
    expect(isStageStatus("archived")).toBe(true);
    expect(isStageStatus("deleted")).toBe(false);
  });
});

describe("stageDisplayRank", () => {
  it("ranks by position among the given Stages, not by array order", () => {
    const stages = [
      { id: "b", position: 6 },
      { id: "a", position: 5 },
      { id: "c", position: 7 }
    ];
    expect(stageDisplayRank(stages, "a")).toBe(1);
    expect(stageDisplayRank(stages, "b")).toBe(2);
    expect(stageDisplayRank(stages, "c")).toBe(3);
  });

  it("is the real production case that motivated it: real curriculum stages start at position 5, not 0, because earlier archived/legacy Stages occupy positions 0-4 and are excluded from the caller's list", () => {
    // loadCareerStages() already excludes archived rows, so the caller only ever passes the active
    // set — but that set's raw .position values are NOT 0-based, which is exactly why badging off
    // .position directly (instead of rank-within-this-list) showed the wrong Stage number in
    // production (docs/academy-data-link-v1/01_PRODUCTION_AUDIT.md).
    const activeStages = [
      { id: "s1", position: 5 }, { id: "s2", position: 6 }, { id: "s3", position: 7 },
      { id: "s4", position: 8 }, { id: "s5", position: 9 }, { id: "s6", position: 10 }
    ];
    expect(stageDisplayRank(activeStages, "s1")).toBe(1);
    expect(stageDisplayRank(activeStages, "s6")).toBe(6);
  });

  it("returns 0 for a Stage not present in the given list (e.g. a hidden/draft Stage ranked against the active-only set)", () => {
    const stages = [{ id: "a", position: 0 }];
    expect(stageDisplayRank(stages, "not-in-list")).toBe(0);
  });
});
