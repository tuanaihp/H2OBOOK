import { describe, expect, it } from "vitest";

// Mirrors middleware.ts's isPathUnder. The middleware itself imports Next server internals and
// cannot be loaded here, so the rule is restated and pinned; if the two drift, the cases below
// describe the behaviour the middleware is required to have.
function isPathUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

describe("public/admin prefix matching is segment-bounded", () => {
  it("does not let a sibling route inherit a neighbour's exemption", () => {
    // The regression: "/academy-admin".startsWith("/academy") is true, so a bare startsWith made
    // the entire admin tree public. Every child under it is a client component with no server
    // guard, so an unauthenticated visitor was served the admin shell.
    expect("/academy-admin".startsWith("/academy")).toBe(true);
    expect(isPathUnder("/academy-admin", "/academy")).toBe(false);
    expect(isPathUnder("/academy-admin/stages", "/academy")).toBe(false);
    expect(isPathUnder("/academy-admin/distribution", "/academy")).toBe(false);
  });

  it("still matches the prefix itself and anything genuinely under it", () => {
    expect(isPathUnder("/academy", "/academy")).toBe(true);
    expect(isPathUnder("/academy/books", "/academy")).toBe(true);
    expect(isPathUnder("/academy/courses/abc", "/academy")).toBe(true);
    expect(isPathUnder("/api/public/foo", "/api/public")).toBe(true);
  });

  it("keeps /verify-outcome public, which the loose match used to cover by accident", () => {
    // A real unauthenticated certificate page. Tightening the match dropped it, so it is now
    // listed in publicPrefixes in its own right — this asserts why that entry has to stay.
    expect(isPathUnder("/verify-outcome/abc", "/verify")).toBe(false);
    expect(isPathUnder("/verify-outcome/abc", "/verify-outcome")).toBe(true);
    expect(isPathUnder("/verify/CERT-1", "/verify")).toBe(true);
  });

  it("does not match a path that merely shares a leading substring", () => {
    expect(isPathUnder("/devops", "/dev")).toBe(false);
    expect(isPathUnder("/logins", "/login")).toBe(false);
    expect(isPathUnder("/readerly", "/reader")).toBe(false);
    expect(isPathUnder("/administration", "/admin")).toBe(false);
  });
});
