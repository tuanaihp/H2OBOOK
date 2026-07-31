import type { CreativeAnalyticsEvent } from "./types";

export function emitCreativeEvent(event: CreativeAnalyticsEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("h2obook:analytics", { detail: event }));
}
