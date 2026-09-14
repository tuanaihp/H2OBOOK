import { describe, expect, it } from "vitest";
import { demoBook } from "@/lib/mock-data";
import { isSampleBookId, resolveStudioHref } from "@/lib/editor/sample-books";

describe("sample book guard", () => {
  it("recognises the seeded demo book", () => {
    expect(isSampleBookId(demoBook.id)).toBe(true);
    expect(isSampleBookId("book_real_customer_123")).toBe(false);
    expect(isSampleBookId(undefined)).toBe(false);
  });

  it("never sends a production user to a sample book", () => {
    expect(resolveStudioHref([{ id: demoBook.id, updatedAt: "2026-09-10" }], true)).toBe("/books");
  });

  it("opens the most recently edited real book", () => {
    const books = [
      { id: "book_old", updatedAt: "2026-08-01" },
      { id: demoBook.id, updatedAt: "2026-09-12" },
      { id: "book_new", updatedAt: "2026-09-01" },
      { id: "book_archived", updatedAt: "2026-09-13", archivedAt: "2026-09-13" }
    ];
    expect(resolveStudioHref(books, true)).toBe("/editor/book_new");
  });

  it("keeps sample books usable in demo mode", () => {
    expect(resolveStudioHref([{ id: demoBook.id, updatedAt: "2026-09-10" }], false)).toBe(`/editor/${demoBook.id}`);
  });
});
