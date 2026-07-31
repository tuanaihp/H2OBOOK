"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Clock3, PauseCircle, ShieldAlert, Sparkles } from "lucide-react";
import type { OperationalStatus } from "@/lib/system-governance-ops-v2/types";
import styles from "./system-governance-ops-v2.module.css";

const labels: Record<OperationalStatus, string> = {
  new: "Mới",
  active: "Đang hoạt động",
  paused: "Tạm dừng",
  draft: "Bản nháp",
  pending: "Đang chờ",
  completed: "Hoàn tất",
  failed: "Thất bại",
  in_progress: "Đang xử lý",
  waiting_customer: "Chờ khách hàng",
  changes_requested: "Yêu cầu sửa",
};

export function OperationsStatus({ status, label }: { status: OperationalStatus; label?: string }) {
  const Icon = status === "active" || status === "completed"
    ? CheckCircle2
    : status === "paused" || status === "draft"
      ? PauseCircle
      : status === "failed" || status === "changes_requested"
        ? ShieldAlert
        : status === "new"
          ? Sparkles
          : Clock3;
  return <span className={`${styles.opsStatus} ${styles[`opsStatus_${status}`]}`}><Icon/>{label ?? labels[status]}</span>;
}

export function OperationsToolbar({ children }: { children: ReactNode }) {
  return <div className={styles.opsToolbar}>{children}</div>;
}

export function OperationsTable({ children, minWidth = 820 }: { children: ReactNode; minWidth?: number }) {
  return <div className={styles.opsTableWrap}><table style={{ minWidth }}>{children}</table></div>;
}

export function OperationsEmpty({ title, description }: { title: string; description: string }) {
  return <div className={styles.opsEmpty}><Sparkles/><strong>{title}</strong><p>{description}</p></div>;
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "success" | "warning" | "blue" }) {
  return <span className={`${styles.opsProgress} ${styles[`opsProgress_${tone}`]}`} aria-label={`${value}%`}><b style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></span>;
}
