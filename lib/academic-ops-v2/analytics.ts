import type { AcademicOpsEventName } from "./types";

export function trackAcademicOpsEvent(
  event: AcademicOpsEventName,
  properties: Record<string, string | number | boolean | null | undefined> = {}
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("h2obook:analytics", {
      detail: {
        event,
        properties: {
          ...properties,
          surface: "academic_operations_v2",
          occurredAt: new Date().toISOString()
        }
      }
    })
  );
}
