"use client";

import Link from "next/link";
import { ArrowRight, BellRing, CheckCheck, CircleDollarSign, GraduationCap, LifeBuoy, UsersRound, Workflow } from "lucide-react";
import { useOperationsStore } from "@/store/operations-store";
import { OperationsMetric } from "./metric-card";
import { StatusBadge } from "./status-badge";
import styles from "./operations.module.css";

export function OperationsDashboard() {
  const store = useOperationsStore();
  const pipelineValue = store.leads.filter((lead) => !["lost", "enrolled"].includes(lead.stage)).reduce((sum, lead) => sum + lead.expectedValue, 0);
  const pendingApprovals = store.approvals.filter((item) => item.status === "pending").length;
  const openTickets = store.tickets.filter((item) => !["resolved", "closed"].includes(item.status)).length;
  return <>
    <header className={styles.header}><div><span className={styles.eyebrow}>H2OBOOK BUSINESS OPERATIONS</span><h1>Trung tâm điều hành học viện</h1><p>Kết nối CRM tuyển sinh, hỗ trợ, phê duyệt, thông báo, dữ liệu và automation vào cùng một không gian vận hành.</p></div><div className={styles.headerActions}><Link className={`${styles.button} ${styles.buttonSecondary}`} href="/operations/admissions">Mở Admissions</Link><Link className={`${styles.button} ${styles.buttonPrimary}`} href="/operations/approvals">Xử lý phê duyệt</Link></div></header>
    <section className={styles.metrics}><OperationsMetric icon={UsersRound} value={store.leads.length} label="Lead đang quản lý"/><OperationsMetric icon={CircleDollarSign} value={`${Math.round(pipelineValue/1_000_000)}M`} label="Giá trị pipeline"/><OperationsMetric icon={LifeBuoy} value={openTickets} label="Ticket cần xử lý"/><OperationsMetric icon={CheckCheck} value={pendingApprovals} label="Phê duyệt đang chờ"/></section>
    <div className={styles.grid}>
      <section className={`${styles.card} ${styles.span7}`}><div className={styles.cardHead}><div><h2>Admissions Pulse</h2><p>Khách cần follow-up và hồ sơ chờ hoàn thiện.</p></div><Link href="/operations/admissions">Mở CRM <ArrowRight size={13}/></Link></div><div className={styles.cardBody}><div className={styles.list}>{store.leads.slice(0,4).map((lead) => <div className={styles.listItem} key={lead.id}><span className={styles.listItemIcon}><GraduationCap size={16}/></span><div><strong>{lead.name}</strong><small>{lead.interest} · {lead.ownerName}</small></div><div className={styles.listItemMeta}><StatusBadge value={lead.stage}/><em>{new Intl.NumberFormat("vi-VN").format(lead.expectedValue)} đ</em></div></div>)}</div></div></section>
      <section className={`${styles.card} ${styles.span5}`}><div className={styles.cardHead}><div><h2>Automation Health</h2><p>Các workflow quan trọng của học viện.</p></div><Workflow size={18}/></div><div className={styles.cardBody}><div className={styles.list}>{store.automations.map((automation) => <div className={styles.listItem} key={automation.id}><span className={styles.listItemIcon}><Workflow size={16}/></span><div><strong>{automation.name}</strong><small>{automation.trigger}</small></div><div className={styles.listItemMeta}><StatusBadge value={automation.status}/><em>{automation.runCount} lượt</em></div></div>)}</div></div></section>
      <section className={`${styles.card} ${styles.span6}`}><div className={styles.cardHead}><div><h2>Support Queue</h2><p>Ưu tiên theo mức độ ảnh hưởng.</p></div><LifeBuoy size={18}/></div><div className={styles.cardBody}><div className={styles.list}>{store.tickets.slice(0,3).map((ticket) => <div className={styles.listItem} key={ticket.id}><span className={styles.listItemIcon}><LifeBuoy size={16}/></span><div><strong>{ticket.subject}</strong><small>{ticket.requesterName} · {ticket.code}</small></div><div className={styles.listItemMeta}><StatusBadge value={ticket.status}/><em>{ticket.priority}</em></div></div>)}</div></div></section>
      <section className={`${styles.card} ${styles.span6}`}><div className={styles.cardHead}><div><h2>Notification Performance</h2><p>Email, Zalo, push và thông báo trong app.</p></div><BellRing size={18}/></div><div className={styles.cardBody}><div className={styles.list}>{store.notificationTemplates.map((item) => <div className={styles.listItem} key={item.id}><span className={styles.listItemIcon}><BellRing size={16}/></span><div><strong>{item.name}</strong><small>{item.channels.join(" · ")}</small></div><div className={styles.listItemMeta}><StatusBadge value={item.enabled ? "active" : "paused"}/><em>{item.sentCount} gửi</em></div></div>)}</div></div></section>
    </div>
  </>;
}
