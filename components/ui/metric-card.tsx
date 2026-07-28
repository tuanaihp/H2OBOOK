import type { LucideIcon } from "lucide-react";
export function MetricCard({ label, value, note, icon: Icon, tone = "primary" }: { label: string; value: string; note: string; icon: LucideIcon; tone?: "primary" | "success" | "warning" | "blue" }) {
  return <article className="metric-card"><div className={`metric-icon tone-${tone}`}><Icon size={19}/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}
