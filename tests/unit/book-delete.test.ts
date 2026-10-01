import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/app-store";

describe("book permanent delete", () => {
  const previousMode = process.env.NEXT_PUBLIC_APP_MODE;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (previousMode === undefined) delete process.env.NEXT_PUBLIC_APP_MODE;
    else process.env.NEXT_PUBLIC_APP_MODE = previousMode;
    vi.unstubAllGlobals();
  });

  it("removes a local book without calling the server in demo mode", async () => {
    delete process.env.NEXT_PUBLIC_APP_MODE;
    const book = useAppStore.getState().createBook({ title: "Sách cần xóa" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await useAppStore.getState().removeBook(book.id);

    expect(result.ok).toBe(true);
    expect(useAppStore.getState().books.find((item) => item.id === book.id)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the local record when the cloud delete fails", async () => {
    process.env.NEXT_PUBLIC_APP_MODE = "production";
    const book = useAppStore.getState().createBook({ title: "Sách cloud" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "BOOK_DELETE_FAILED" }), { status: 500 })
    ));

    const result = await useAppStore.getState().removeBook(book.id);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("BOOK_DELETE_FAILED");
    expect(useAppStore.getState().books.find((item) => item.id === book.id)).toBeDefined();
  });

  it("still deletes locally when the cloud copy is already gone (404)", async () => {
    process.env.NEXT_PUBLIC_APP_MODE = "production";
    const book = useAppStore.getState().createBook({ title: "Sách chưa sync" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "BOOK_NOT_FOUND" }), { status: 404 })
    ));

    const result = await useAppStore.getState().removeBook(book.id);

    expect(result.ok).toBe(true);
    expect(useAppStore.getState().books.find((item) => item.id === book.id)).toBeUndefined();
  });
});
