"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Filter, Headphones, Search, UserRoundPlus } from "lucide-react";
import { supportTickets as initialTickets } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Metric, Panel, SystemPageHeader } from "../system-shared";
import { OperationsStatus, OperationsTable } from "../operations-shared";
import styles from "../system-governance-ops-v2.module.css";

export function OperationsSupportV2() {
  const [tickets, setTickets] = useState(initialTickets);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => tickets.filter((ticket) => `${ticket.title} ${ticket.requester} ${ticket.id}`.toLowerCase().includes(query.toLowerCase())), [tickets, query]);
  const resolve = (id: string) => { setTickets((items) => items.map((item) => item.id === id ? { ...item, status: "resolved" } : item)); emitSystemEvent("operations_ticket_updated", { ticketId: id, status: "resolved" }); };
  return <>
    <SystemPageHeader eyebrow="H2OBOOK OPERATIONS" title="Support Center" description="Quản lý yêu cầu tài khoản, thanh toán, bài học, nội dung và chính sách theo SLA." actions={<button className={styles.primaryButton}><UserRoundPlus/> Tạo ticket</button>}/>
    <div className={styles.metricGrid}><Metric label="Đang mở" value={String(tickets.filter((item) => item.status === "open").length)} note="Cần tiếp nhận" icon={<Headphones/>}/><Metric label="Đang xử lý" value={String(tickets.filter((item) => item.status === "in_progress").length)} note="Có người phụ trách" tone="blue" icon={<Filter/>}/><Metric label="Chờ khách hàng" value={String(tickets.filter((item) => item.status === "waiting_customer").length)} note="Tạm dừng SLA" tone="warning" icon={<Search/>}/><Metric label="Đã giải quyết" value={String(tickets.filter((item) => item.status === "resolved").length)} note="Trong phiên" tone="success" icon={<CheckCircle2/>}/></div>
    <div className={styles.opsToolbar}><label className={styles.opsSearch}><Search/><input value={query} onChange={(event: { target: { value: string } }) => setQuery(event.target.value)} placeholder="Tìm ticket, học viên hoặc mã yêu cầu..."/></label><button className={styles.secondaryButton}><Filter/> Bộ lọc</button></div>
    <Panel title="Ticket vận hành" description="Quyền xem và cập nhật phải được giới hạn theo workspace và vai trò." icon={<Headphones/>}><OperationsTable minWidth={900}><thead><tr><th>Ticket</th><th>Người gửi</th><th>Loại</th><th>Ưu tiên</th><th>Phụ trách</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{filtered.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.title}</strong><small>{ticket.id} · {ticket.createdAt}</small></td><td>{ticket.requester}</td><td>{ticket.category}</td><td><span className={`${styles.risk} ${styles[`risk_${ticket.priority === "urgent" ? "high" : ticket.priority === "high" ? "high" : "low"}`]}`}>{ticket.priority}</span></td><td>{ticket.assignee ?? "Chưa phân công"}</td><td><OperationsStatus status={ticket.status === "open" ? "new" : ticket.status === "resolved" ? "completed" : ticket.status}/></td><td><button className={styles.secondaryButton} disabled={ticket.status === "resolved"} onClick={() => resolve(ticket.id)}><CheckCircle2/> Đánh dấu xong</button></td></tr>)}</tbody></OperationsTable></Panel>
  </>;
}
