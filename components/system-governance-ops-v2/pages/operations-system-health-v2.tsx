"use client";

import { useState } from "react";
import { Activity, CloudCog, Database, RefreshCw, ServerCog, TriangleAlert } from "lucide-react";
import { operationsHealthServices } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Metric, Panel, SystemPageHeader } from "../system-shared";
import { OperationsStatus, ProgressBar } from "../operations-shared";
import styles from "../system-governance-ops-v2.module.css";

export function OperationsSystemHealthV2() {
  const [lastChecked, setLastChecked] = useState("31/07/2026 08:40");
  const recheck = () => { const now = new Date().toLocaleTimeString("vi-VN"); setLastChecked(now); emitSystemEvent("operations_health_rechecked", { at: now }); };
  const healthy = operationsHealthServices.filter((item) => item.status === "active").length;
  return <>
    <SystemPageHeader eyebrow="H2OBOOK OPERATIONS" title="System Health" description="Theo dõi database, storage, queue, workers, email, payment và webhook từ endpoint server-side." actions={<button className={styles.primaryButton} onClick={recheck}><RefreshCw/> Kiểm tra lại</button>}/>
    <div className={styles.metricGrid}><Metric label="Dịch vụ ổn định" value={`${healthy}/${operationsHealthServices.length}`} note={`Kiểm tra ${lastChecked}`} icon={<Activity/>}/><Metric label="Đang theo dõi" value={String(operationsHealthServices.filter((item) => item.status === "monitoring").length)} note="Không chặn hệ thống" tone="warning" icon={<TriangleAlert/>}/><Metric label="Queue backlog" value={String(operationsHealthServices.reduce((sum, item) => sum + (item.queueDepth ?? 0), 0))} note="Mọi worker" tone="blue" icon={<ServerCog/>}/><Metric label="Provider online" value="3" note="Email · Payment · Webhook" tone="success" icon={<CloudCog/>}/></div>
    <Panel title="Runtime services" description="Preview dùng dữ liệu mẫu; Production chỉ lấy từ health API đã xác thực." icon={<Database/>}><div className={styles.healthGrid}>{operationsHealthServices.map((service) => <article key={service.id}><span className={styles.opsIconBox}>{service.id === "db" ? <Database/> : service.id.includes("worker") || service.id === "document" || service.id === "publishing" ? <ServerCog/> : <CloudCog/>}</span><div><h3>{service.name}</h3><p>{service.detail}</p><small>Cập nhật {service.lastCheckedAt}</small></div><div className={styles.healthMeta}><OperationsStatus status={service.status === "active" ? "active" : service.status === "offline" ? "failed" : "pending"} label={service.status}/><span>{service.latencyMs ? `${service.latencyMs} ms` : "—"}</span>{typeof service.queueDepth === "number" ? <small>{service.queueDepth} job</small> : null}</div><ProgressBar value={service.status === "active" ? 100 : service.status === "monitoring" ? 65 : 20} tone={service.status === "active" ? "success" : "warning"}/></article>)}</div></Panel>
  </>;
}
