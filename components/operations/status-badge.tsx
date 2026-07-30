import styles from "./operations.module.css";

const toneMap: Record<string, "success" | "warning" | "danger" | "purple" | "neutral"> = {
  active: "success", paid: "success", completed: "success", resolved: "success", approved: "success", valid: "success", enrolled: "success",
  pending: "warning", deposit: "warning", in_progress: "warning", waiting_customer: "warning", changes_requested: "warning", past_due: "warning", trial: "warning",
  urgent: "danger", critical: "danger", failed: "danger", rejected: "danger", suspended: "danger", revoked: "danger", lost: "danger",
  processing: "purple", consulted: "purple", qualified: "purple", monitoring: "purple"
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return <span className={styles.badge} data-tone={toneMap[value] ?? "neutral"}>{label ?? value.replaceAll("_", " ")}</span>;
}
