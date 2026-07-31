"use client";

import { useState } from "react";
import { BellRing, Mail, MessageCircle, Pause, Play, Plus, Send } from "lucide-react";
import { notificationTemplates as initialTemplates } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Metric, Panel, SystemPageHeader } from "../system-shared";
import { OperationsStatus, ProgressBar } from "../operations-shared";
import styles from "../system-governance-ops-v2.module.css";

export function OperationsNotificationsV2() {
  const [templates, setTemplates] = useState(initialTemplates);
  const toggle = (id: string) => setTemplates((items) => items.map((item) => {
    if (item.id !== id) return item;
    const status = item.status === "active" ? "paused" : "active";
    emitSystemEvent("operations_notification_toggled", { templateId: id, status });
    return { ...item, status };
  }));
  return <>
    <SystemPageHeader eyebrow="H2OBOOK OPERATIONS" title="Notification Center" description="Quản lý template và hiệu suất gửi email, Zalo, push, Telegram và in-app." actions={<button className={styles.primaryButton}><Plus/> Tạo template</button>}/>
    <div className={styles.metricGrid}><Metric label="Template active" value={String(templates.filter((item) => item.status === "active").length)} note="Đang gửi tự động" icon={<BellRing/>}/><Metric label="Tổng đã gửi" value={String(templates.reduce((sum, item) => sum + item.sent, 0))} note="Trong kỳ" tone="blue" icon={<Send/>}/><Metric label="Lỗi giao nhận" value={String(templates.reduce((sum, item) => sum + item.errors, 0))} note="Cần retry" tone="warning" icon={<Mail/>}/><Metric label="Kênh hỗ trợ" value="5" note="Email · Zalo · Push · Telegram · In-app" tone="success" icon={<MessageCircle/>}/></div>
    <Panel title="Template đa kênh" description="Preview dùng state local; Production phải kiểm tra consent, unsubscribe và rate limit." icon={<BellRing/>}><div className={styles.notificationList}>{templates.map((template) => <article key={template.id}><span className={styles.opsIconBox}><BellRing/></span><div><OperationsStatus status={template.status}/><h3>{template.name}</h3><p><code>{template.event}</code></p><div className={styles.channelChips}>{template.channels.map((channel) => <span key={channel}>{channel}</span>)}</div><ProgressBar value={template.sent ? Math.round(((template.sent - template.errors) / template.sent) * 100) : 0} tone="success"/></div><div className={styles.workflowStats}><strong>{template.sent}</strong><small>đã gửi</small><span>{template.errors} lỗi</span></div><button className={template.status === "active" ? styles.secondaryButton : styles.primaryButton} onClick={() => toggle(template.id)}>{template.status === "active" ? <><Pause/> Tạm dừng</> : <><Play/> Kích hoạt</>}</button></article>)}</div></Panel>
  </>;
}
