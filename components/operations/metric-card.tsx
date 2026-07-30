import type { LucideIcon } from "lucide-react";
import styles from "./operations.module.css";

export function OperationsMetric({ icon: Icon, value, label }: { icon: LucideIcon; value: string | number; label: string }) {
  return <article className={styles.metric}><span className={styles.metricIcon}><Icon size={19}/></span><div><strong>{value}</strong><span>{label}</span></div></article>;
}
