import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeferredLocalStorage } from "@/lib/storage/deferred-local-storage";

describe("createDeferredLocalStorage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("coalesces rapid writes and keeps synchronous reads compatible", () => {
    vi.useFakeTimers();
    const dom = new JSDOM("", { url: "https://h2obook.test" });
    vi.stubGlobal("window", dom.window);
    const storage = createDeferredLocalStorage<{ count: number }>();

    storage.setItem("workspace", { state: { count: 1 }, version: 1 });
    storage.setItem("workspace", { state: { count: 2 }, version: 1 });
    expect(dom.window.localStorage.getItem("workspace")).toBeNull();

    vi.advanceTimersByTime(300);
    expect(storage.getItem("workspace")).toEqual({ state: { count: 2 }, version: 1 });
  });

  it("flushes pending state before the page is hidden", () => {
    vi.useFakeTimers();
    const dom = new JSDOM("", { url: "https://h2obook.test" });
    vi.stubGlobal("window", dom.window);
    const storage = createDeferredLocalStorage<{ ready: boolean }>();

    storage.setItem("workspace", { state: { ready: true }, version: 1 });
    dom.window.dispatchEvent(new dom.window.Event("pagehide"));

    expect(storage.getItem("workspace")).toEqual({ state: { ready: true }, version: 1 });
  });
});
