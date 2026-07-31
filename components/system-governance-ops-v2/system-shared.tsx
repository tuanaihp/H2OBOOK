"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDot, Sparkles } from "lucide-react";
import { getSystemSurfaceGroup } from "@/lib/system-governance-ops-v2/registry";
import type { HealthStatus, SystemSurface } from "@/lib/system-governance-ops-v2/types";
import styles from "./system-governance-ops-v2.module.css";

export function SystemPageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className={styles.pageHeader}><div><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions ? <div className={styles.headerActions}>{actions}</div> : null}</header>;
}

export function SystemSurfaceNav({ active }: { active: SystemSurface }) {
  const groups = [
    { id: "personal" as const, label: "Tài khoản" },
    { id: "governance" as const, label: "System Governance" },
    { id: "operations" as const, label: "Operations Center" },
  ];
  return <nav className={styles.surfaceNavigator} aria-label="System governance and operations surfaces">{groups.map((group) => {
    const stages = getSystemSurfaceGroup(group.id);
    return <section key={group.id}><header>{group.label}</header><div className={styles.pipeline}>{stages.map((stage, index) => {
      const selected = stage.id === active;
      return <Link key={stage.id} href={`/system-governance-ops-v2-preview/${stage.id}`} className={selected ? styles.pipelineActive : ""}><span>{index + 1}</span><div><strong>{stage.label}</strong><small>{stage.description}</small></div>{index < stages.length - 1 ? <ArrowRight/> : null}</Link>;
    })}</div></section>;
  })}</nav>;
}

export function Panel({ title, description, icon, children, className = "" }: { title: string; description?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`${styles.panel} ${className}`}><header><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{icon}</header>{children}</section>;
}

export function Metric({ label, value, note, tone = "default", icon }: { label: string; value: string; note: string; tone?: "default" | "success" | "warning" | "blue"; icon?: ReactNode }) {
  return <article className={`${styles.metric} ${styles[`metric_${tone}`]}`}><span>{icon ?? <Sparkles/>}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

export function StatusBadge({ status, label }: { status: HealthStatus | "active" | "missing" | "warning"; label?: string }) {
  const success = status === "healthy" || status === "active";
  const warning = status === "warning" || status === "missing";
  const Icon = success ? CheckCircle2 : warning ? AlertTriangle : CircleDot;
  return <span className={`${styles.status} ${success ? styles.statusSuccess : warning ? styles.statusWarning : styles.statusNeutral}`}><Icon/>{label ?? status}</span>;
}

export function Notice({ title, children, tone = "info" }: { title: string; children: ReactNode; tone?: "info" | "warning" | "success" }) {
  return <div className={`${styles.notice} ${styles[`notice_${tone}`]}`}><strong>{title}</strong><span>{children}</span></div>;
}
