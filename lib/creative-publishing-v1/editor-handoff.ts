import type { CreativeHandoff } from "./types";

const STORAGE_KEY = "h2obook-creative-handoff-v1";

export function queueCreativeHandoff(input: Omit<CreativeHandoff, "id" | "createdAt">): CreativeHandoff {
  const handoff: CreativeHandoff = {
    ...input,
    id: globalThis.crypto?.randomUUID?.() ?? `handoff_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
    window.dispatchEvent(new CustomEvent("h2obook:creative-handoff", { detail: handoff }));
  }
  return handoff;
}

export function readCreativeHandoff(): CreativeHandoff | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as CreativeHandoff;
  } catch {
    return null;
  }
}

export function clearCreativeHandoff(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}
