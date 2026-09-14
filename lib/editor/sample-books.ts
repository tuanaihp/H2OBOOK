import { demoBook, libraryBooks } from "@/lib/mock-data";

// Seed/sample books ship inside the client bundle so Demo Mode has something to edit. In Production
// they must never be opened as if they were the organization's own project: saving one would write
// the fake "Giáo trình Makeup Chuyên Nghiệp" into the real org through cloud-save.
export const SAMPLE_BOOK_IDS: ReadonlySet<string> = new Set([demoBook.id, ...libraryBooks.map((book) => book.id)]);

export function isProductionMode() {
  return process.env.NEXT_PUBLIC_APP_MODE === "production";
}

export function isSampleBookId(id: string | null | undefined) {
  return Boolean(id && SAMPLE_BOOK_IDS.has(id));
}

type BookLike = { id: string; updatedAt?: string | null; archivedAt?: string | null };

/** Where "H2OBOOK Studio" should land: the user's most recently edited real book, else the project list. */
export function resolveStudioHref(books: readonly BookLike[], production = isProductionMode()) {
  const candidates = books
    .filter((book) => !book.archivedAt && !(production && isSampleBookId(book.id)))
    .slice()
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return candidates[0] ? `/editor/${candidates[0].id}` : "/books";
}
