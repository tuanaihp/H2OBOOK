"use client";

import Link from "next/link";
import { BellRing, Bot, CheckSquare2, CircleDollarSign, Headphones, Users } from "lucide-react";
import { admissionLeads, approvalRequests, automationWorkflows, notificationTemplates, supportTickets } from "@/lib/system-governance-ops-v2/data";
import { Metric, Panel, SystemPageHeader } from "../system-shared";
import { OperationsStatus, ProgressBar } from "../operations-shared";
import styles from "../system-governance-ops-v2.module.css";

const money = new Intl.NumberFormat("vi-VN");

export function OperationsV2() {
  const pipelineValue = admissionLeads.reduce((sum, lead) => sum + lead.value, 0);
  return <>
    <SystemPageHeader
      eyebrow="H2OBOOK BUSINESS OPERATIONS"
      title="Trung tâm điều hành học viên"
      description="Kết nối CRM tuyển sinh, hỗ trợ, phê duyệt, thông báo, dữ liệu và automation vào cùng một không gian vận hành."
      actions={<><Link className={styles.secondaryButton} href="/system-governance-ops-v2-preview/operations-admissions">Mở Admissions</Link><Link className={styles.primaryButton} href="/system-governance-ops-v2-preview/operations-approvals">Xử lý phê duyệt</Link></>}
    />
    <div className={styles.metricGrid}>
      <Metric label="Lead đang quản lý" value={String(admissionLeads.length)} note="Toàn bộ pipeline" icon={<Users/>}/>
      <Metric label="Giá trị pipeline" value={`${Math.round(pipelineValue / 1_000_000)}M`} note="Doanh thu tiềm năng" tone="blue" icon={<CircleDollarSign/>}/>
      <Metric label="Ticket cần xử lý" value={String(supportTickets.filter((item) => item.status !== "resolved").length)} note="Theo SLA" tone="warning" icon={<Headphones/>}/>
      <Metric label="Phê duyệt đang chờ" value={String(approvalRequests.filter((item) => item.status !== "approved").length)} note="Nhiều nhóm nội dung" tone="success" icon={<CheckSquare2/>}/>
    </div>

    <Panel title="Admissions Pulse" description="Khách cần follow-up và hồ sơ chưa hoàn thiện." icon={<Users/>}>
      <div className={styles.opsFeed}>
        {admissionLeads.map((lead) => <Link href="/system-governance-ops-v2-preview/operations-admissions" key={lead.id}>
          <span className={styles.opsAvatar}>{lead.name.split(" ").slice(-2).map((part) => part[0]).join("")}</span>
          <span><strong>{lead.name}</strong><small>{lead.product} · {lead.owner}</small></span>
          <span className={styles.opsRight}><OperationsStatus status={lead.stage === "new" ? "new" : lead.stage === "deposit" ? "pending" : "in_progress"} label={lead.stage}/><small>{money.format(lead.value)} đ</small></span>
        </Link>)}
      </div>
    </Panel>

    <div className={styles.twoColumn}>
      <Panel title="Automation Health" description="Workflow quan trọng của học viện." icon={<Bot/>}>
        <div className={styles.opsFeed}>{automationWorkflows.map((workflow) => <Link href="/system-governance-ops-v2-preview/operations-automation-center" key={workflow.id}>
          <span className={styles.opsIconBox}><Bot/></span><span><strong>{workflow.name}</strong><small>{workflow.trigger} · {workflow.steps.length} hành động</small></span><span className={styles.opsRight}><OperationsStatus status={workflow.status}/><small>{workflow.runs} lượt · {workflow.errors} lỗi</small></span>
        </Link>)}</div>
      </Panel>
      <Panel title="Support Queue" description="Ưu tiên theo mức độ ảnh hưởng." icon={<Headphones/>}>
        <div className={styles.opsFeed}>{supportTickets.map((ticket) => <Link href="/system-governance-ops-v2-preview/operations-support" key={ticket.id}>
          <span className={styles.opsIconBox}><Headphones/></span><span><strong>{ticket.title}</strong><small>{ticket.requester} · {ticket.id}</small></span><span className={styles.opsRight}><OperationsStatus status={ticket.status === "open" ? "new" : ticket.status === "resolved" ? "completed" : ticket.status}/><small>{ticket.priority}</small></span>
        </Link>)}</div>
      </Panel>
    </div>

    <Panel title="Notification Performance" description="Email, Zalo, push, Telegram và thông báo trong app." icon={<BellRing/>}>
      <div className={styles.opsFeed}>{notificationTemplates.map((template) => <Link href="/system-governance-ops-v2-preview/operations-notifications" key={template.id}>
        <span className={styles.opsIconBox}><BellRing/></span><span><strong>{template.name}</strong><small>{template.event} · {template.channels.join(" · ")}</small></span><span className={styles.opsRight}><OperationsStatus status={template.status}/><small>{template.sent} gửi · {template.errors} lỗi</small></span>
        <ProgressBar value={template.sent ? Math.round(((template.sent - template.errors) / template.sent) * 100) : 0} tone="success"/>
      </Link>)}</div>
    </Panel>
  </>;
}
