import type { BusinessAnalyticsEvent } from "./types";

const queueKey = "h2obook-business-ops-v1-event-queue";

export function emitBusinessEvent(event: BusinessAnalyticsEvent) {
  if (typeof window === "undefined") return;
  const payload = { ...event, eventId: crypto.randomUUID(), createdAt: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent("h2obook:business-event", { detail: payload }));
  try {
    const current = JSON.parse(localStorage.getItem(queueKey) ?? "[]") as unknown[];
    localStorage.setItem(queueKey, JSON.stringify([...current.slice(-199), payload]));
  } catch {
    // Preview queue must never block the business UI.
  }
}
