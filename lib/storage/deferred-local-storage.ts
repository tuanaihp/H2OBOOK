import type { PersistStorage, StorageValue } from "zustand/middleware";

/**
 * Coalesces Zustand persistence writes and serializes them after interaction work.
 * Reads stay synchronous, preserving existing localStorage data and hydration.
 */
export function createDeferredLocalStorage<State>(): PersistStorage<State> {
  const pending = new Map<string, StorageValue<State>>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (typeof window === "undefined") return;
    if (timer) clearTimeout(timer);
    timer = undefined;
    for (const [name, value] of pending) {
      try { window.localStorage.setItem(name, JSON.stringify(value)); }
      catch { /* The in-memory store remains usable if browser storage is unavailable. */ }
    }
    pending.clear();
  };

  if (typeof window !== "undefined") window.addEventListener("pagehide", flush);

  return {
    getItem(name) {
      if (typeof window === "undefined") return null;
      try {
        const value = window.localStorage.getItem(name);
        return value ? JSON.parse(value) as StorageValue<State> : null;
      } catch { return null; }
    },
    setItem(name, value) {
      pending.set(name, value);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 300);
    },
    removeItem(name) {
      pending.delete(name);
      if (typeof window !== "undefined") window.localStorage.removeItem(name);
    }
  };
}
