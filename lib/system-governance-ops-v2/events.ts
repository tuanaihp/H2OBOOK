export type SystemEventName =
  | "system_surface_viewed"
  | "system_action_clicked"
  | "system_policy_saved"
  | "system_sync_requested"
  | "system_security_check_requested"
  | "system_connection_recheck_requested"
  | "operations_surface_viewed"
  | "operations_lead_stage_changed"
  | "operations_approval_decided"
  | "operations_workflow_toggled"
  | "operations_import_committed"
  | "operations_import_rolled_back"
  | "operations_notification_toggled"
  | "operations_product_config_opened"
  | "operations_ticket_updated"
  | "operations_health_rechecked";

export function emitSystemEvent(name: SystemEventName, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("h2obook:system-governance-operations", {
    detail: { name, payload, eventId: crypto.randomUUID(), createdAt: new Date().toISOString() },
  }));
}
