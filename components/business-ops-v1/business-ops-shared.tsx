"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CircleCheck, CircleDot, CircleAlert, Sparkles } from "lucide-react";
import { businessPipeline } from "@/lib/business-ops-v1/pipeline";
import type { BusinessSurface } from "@/lib/business-ops-v1/types";
import styles from "./business-ops-v1.module.css";

export function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export function BusinessPageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className={styles.pageHeader}><div><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions ? <div className={styles.headerActions}>{actions}</div> : null}</div>;
}

export function BusinessPipelineBar({ active }: { active: BusinessSurface }) {
  return <nav className={styles.pipeline} aria-label="Business data pipeline">{businessPipeline.map((stage, index) => {
    const selected = stage.surface === active;
    return <Link key={stage.id} href={`/business-ops-v1-preview/${stage.surface}`} className={selected ? styles.pipelineActive : ""}><span>{index + 1}</span><div><strong>{stage.label}</strong><small>{stage.description}</small></div>{index < businessPipeline.length - 1 ? <ArrowRight/> : null}</Link>;
  })}</nav>;
}

export function Panel({ title, description, icon, children, className = "" }: { title: string; description?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`${styles.panel} ${className}`}><header><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{icon}</header>{children}</section>;
}

export function Metric({ label, value, note, tone = "default", icon }: { label: string; value: string; note: string; tone?: "default" | "success" | "warning" | "blue"; icon?: ReactNode }) {
  return <article className={`${styles.metric} ${styles[`metric_${tone}`]}`}><span>{icon ?? <Sparkles/>}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const success = ["active", "paid", "granted", "hoạt động", "đã thanh toán", "đã cấp quyền"].some((item) => normalized.includes(item));
  const warning = ["pending", "trial", "draft", "chờ", "dùng thử"].some((item) => normalized.includes(item));
  const Icon = success ? CircleCheck : warning ? CircleAlert : CircleDot;
  return <span className={`${styles.status} ${success ? styles.statusSuccess : warning ? styles.statusWarning : styles.statusNeutral}`}><Icon/>{status}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.emptyState}>{children}</div>;
}
