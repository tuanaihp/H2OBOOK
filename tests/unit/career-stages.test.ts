import { describe, expect, it } from "vitest";
import { isStageResourceAccess, isStageResourceType, isStageStatus, toStageSlug, STAGE_RESOURCE_TYPES } from "@/lib/career-stages/types";

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
