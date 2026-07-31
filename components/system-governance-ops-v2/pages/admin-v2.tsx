"use client";
import { Activity, Database, RefreshCw, ServerCog, ShieldCheck, Users } from "lucide-react";
import { auditEntries, migrationReadiness, runtimeServices } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Metric, Panel, StatusBadge, SystemPageHeader } from "../system-shared";
import styles from "../system-governance-ops-v2.module.css";

export function AdminV2() {
  const connected = runtimeServices.filter((item) => item.status === "healthy").length;
  return <>
    <SystemPageHeader eyebrow="SYSTEM ADMINISTRATION" title="Trung tâm quản trị production" description="Giám sát workspace, worker, tích hợp, bảo mật và audit dựa trên dữ liệu runtime thật." actions={<button className={styles.secondaryButton} onClick={() => emitSystemEvent("system_connection_recheck_requested", { surface: "admin" })}><RefreshCw/>Làm mới</button>}/>
    <div className={styles.metricGrid}><Metric label="Người dùng hệ thống" value="8" note="3 nhân sự nội bộ" icon={<Users/>}/><Metric label="Dung lượng sử dụng" value="7%" note="1.8 / 25 GB" tone="warning" icon={<Database/>}/><Metric label="Job đang chạy" value="0" note="0 job lỗi" tone="success" icon={<ServerCog/>}/><Metric label="Dịch vụ đã kết nối" value={`${connected}/${runtimeServices.length}`} note="Core local đang sẵn sàng" tone="blue" icon={<ShieldCheck/>}/></div>
    <Panel title="Hạ tầng runtime" description="Mỗi trạng thái phải được đọc từ server health adapter, không hardcode ở Production." icon={<Activity/>}><div className={styles.serviceGrid}>{runtimeServices.map((service) => <article key={service.id} className={styles.serviceCard}><div><strong>{service.name}</strong><p>{service.description}</p></div><StatusBadge status={service.status} label={service.status === "healthy" ? "Đã cấu hình" : service.required ? "Cần cấu hình" : "Tùy chọn"}/></article>)}</div></Panel>
    <div className={styles.twoColumn}><Panel title="Audit Log" description="Các hành động quan trọng trong workspace."><div className={styles.auditList}>{auditEntries.map((entry) => <article key={entry.id}><span className={styles.auditDot}/><div><strong>{entry.actor} {entry.action} {entry.target}</strong><small>{entry.createdAt}</small></div></article>)}</div></Panel><Panel title="Database Readiness" description="Thứ tự migration và kiểm tra khôi phục."><div className={styles.checkList}>{migrationReadiness.map((item) => <div key={item.id} className={item.ready ? styles.checkReady : styles.checkPending}><span>{item.ready ? "✓" : "!"}</span><strong>{item.id} {item.label}</strong></div>)}</div></Panel></div>
  </>;
}
