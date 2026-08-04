import { describe, expect, it } from "vitest";
import { buildCompactNavigation, resolveActiveItem } from "@/lib/student/compact-navigation";

const studentGroups = buildCompactNavigation({ role: "student", subscription: "basic" });

describe("resolveActiveItem", () => {
  it("marks exactly one entry active on the student home", () => {
    expect(resolveActiveItem(studentGroups, "/student")).toEqual({ itemId: "smart-home", groupId: "home" });
  });

  it("does not let /student swallow every deeper page", () => {
    // The regression this function exists for: startsWith("/student/") is true for every student
    // route, so Smart Home used to stay highlighted alongside the page actually being viewed.
    const { itemId, groupId } = resolveActiveItem(studentGroups, "/student/assignments");
    expect(itemId).toBe("practice");
    expect(groupId).toBe("learn");
  });

  it("prefers the longest matching href over its ancestors", () => {
    // /student/business/customers matches /student, /student/business and itself.
    expect(resolveActiveItem(studentGroups, "/student/business/customers").itemId).toBe("business-customers");
    // /student/create/projects matches /student, /student/create and itself.
    expect(resolveActiveItem(studentGroups, "/student/create/projects").itemId).toBe("my-projects");
  });

  it("keeps a nested child on its parent entry", () => {
    expect(resolveActiveItem(studentGroups, "/student/create/projects/abc123").itemId).toBe("my-projects");
    expect(resolveActiveItem(studentGroups, "/student/courses/makeup-101").itemId).toBe("journey");
  });

  it("returns nothing for a path outside the navigation", () => {
    expect(resolveActiveItem(studentGroups, "/academy/courses")).toEqual({ itemId: null, groupId: null });
  });

  it("does not match a sibling that merely shares a prefix string", () => {
    // "/student/librarything" must not resolve to "/student/library".
    expect(resolveActiveItem(studentGroups, "/student/librarything").itemId).not.toBe("library");
  });
});

describe("buildCompactNavigation", () => {
  it("gives a student more than one item in LEARN, CREATE and BUSINESS so they are worth collapsing", () => {
    for (const id of ["learn", "create", "business"]) {
      const group = studentGroups.find((candidate) => candidate.id === id);
      expect(group, `group ${id} missing`).toBeDefined();
      expect(group!.items.length).toBeGreaterThan(1);
    }
  });

  it("leaves HOME as a single entry, so it stays a plain label rather than a toggle", () => {
    expect(studentGroups.find((group) => group.id === "home")!.items).toHaveLength(1);
  });

  it("returns no groups at all for owner and admin, who keep the workspace sidebar", () => {
    expect(buildCompactNavigation({ role: "owner", subscription: "basic" })).toHaveLength(0);
    expect(buildCompactNavigation({ role: "admin", subscription: "basic" })).toHaveLength(0);
  });
});
