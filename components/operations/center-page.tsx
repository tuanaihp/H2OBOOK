"use client";

import { AlertTriangle, BellRing, CheckCheck, CloudCog, FileInput, LifeBuoy, Loader2, Play, RefreshCw, Settings2, Workflow } from "lucide-react";
import { useOperationsStore } from "@/store/operations-store";
import { AdmissionsPipeline } from "./admissions-pipeline";
import { StatusBadge } from "./status-badge";
import { useApprovalRequests, useOperationsHealth, useSupportTickets } from "./use-operations-data";
import styles from "./operations.module.css";

export type CenterKind = "admissions" | "support" | "approvals" | "notifications" | "import" | "automation" | "product" | "health";

/** Seed-only surfaces keep their sample rows but must say so — a silent demo table reads as real. */
function DemoNotice() {
  return <p className={styles.pipelineNotice}>Dữ liệu mẫu (demo) — khu vực này chưa nối cơ sở dữ liệu thật; thay đổi chỉ lưu trên trình duyệt này.</p>;
}

function SupportTable() {
  const { mode, rows, error, busyId, reload, updateStatus } = useSupportTickets();
  const toggle = async (ticketId: string, status: string) => {
    try { await updateStatus(ticketId, status === "resolved" ? "open" : "resolved"); } catch { /* row already rolled back */ }
  };
  if (mode === "loading") return <div className={styles.empty}><Loader2 className={styles.spin}/><strong>Đang tải yêu cầu hỗ trợ…</strong></div>;
  return <>
    {mode === "demo" && <DemoNotice/>}
    {error && <p className={styles.pipelineNotice} data-tone="error" role="alert">{error}<button type="button" onClick={() => void reload()}><RefreshCw size={11}/>Tải lại</button></p>}
    {mode === "production" && !error && rows.length === 0 && <div className={styles.empty}><strong>Chưa có yêu cầu hỗ trợ</strong><p>Ticket tạo từ portal học viên hoặc nhân viên sẽ xuất hiện ở đây.</p></div>}
    <section className={styles.card}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ticket</th><th>Người gửi</th><th>Loại</th><th>Ưu tiên</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map((ticket)=><tr key={ticket.id}><td><strong>{ticket.subject}</strong><small>{ticket.code}</small></td><td>{ticket.requesterName}</td><td>{ticket.category}</td><td><StatusBadge value={ticket.priority}/></td><td><StatusBadge value={ticket.status}/></td><td><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={Boolean(busyId)} onClick={()=>void toggle(ticket.id,ticket.status)}>{busyId===ticket.id?"Đang lưu…":ticket.status==="resolved"?"Mở lại":"Đánh dấu xong"}</button></td></tr>)}</tbody></table></div></section>
  </>;
}

function ApprovalsTable() {
  const { mode, rows, error, busyId, reload, decide } = useApprovalRequests();
  const run = async (id: string, decision: "approved" | "changes_requested") => {
    const result = await decide(id, decision);
    if (!result.ok && result.error && result.error !== "BUSY" && result.error !== "NOT_FOUND") void reload();
  };
  if (mode === "loading") return <div className={styles.empty}><Loader2 className={styles.spin}/><strong>Đang tải phê duyệt…</strong></div>;
  return <>
    {mode === "demo" && <DemoNotice/>}
    {error && <p className={styles.pipelineNotice} data-tone="error" role="alert">{error}<button type="button" onClick={() => void reload()}><RefreshCw size={11}/>Tải lại</button></p>}
    {mode === "production" && !error && rows.length === 0 && <div className={styles.empty}><strong>Chưa có yêu cầu phê duyệt</strong><p>Nội dung gửi duyệt từ Studio/Academy sẽ xuất hiện ở đây.</p></div>}
    <section className={styles.card}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Yêu cầu</th><th>Người gửi</th><th>Rủi ro</th><th>Trạng thái</th><th>Quyết định</th></tr></thead><tbody>{rows.map((item)=><tr key={item.id}><td><strong>{item.title}</strong><small>{item.type}</small></td><td>{item.requesterName}</td><td><StatusBadge value={item.riskLevel}/></td><td><StatusBadge value={item.status}/></td><td><div className={styles.headerActions}>{item.status === "pending" ? <><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={Boolean(busyId)} onClick={()=>void run(item.id,"changes_requested")}>Yêu cầu sửa</button><button className={`${styles.button} ${styles.buttonPrimary}`} disabled={Boolean(busyId)} onClick={()=>void run(item.id,"approved")}>{busyId===item.id?"Đang lưu…":"Duyệt"}</button></> : <em>Đã xử lý</em>}</div></td></tr>)}</tbody></table></div></section>
  </>;
}

function HealthGrid() {
  const { health, error, loading, reload } = useOperationsHealth();
  if (loading) return <div className={styles.empty}><Loader2 className={styles.spin}/><strong>Đang kiểm tra hệ thống…</strong></div>;
  if (error) return <p className={styles.pipelineNotice} data-tone="error" role="alert">{error}<button type="button" onClick={() => void reload()}><RefreshCw size={11}/>Kiểm tra lại</button></p>;
  if (!health) return null;
  const tone = (status: string, required: boolean) => status === "ok" ? "active" : status === "error" ? "failed" : required ? "failed" : "monitoring";
  return <>
    {health.mode === "demo" && <DemoNotice/>}
    <p className={styles.pipelineNotice} data-tone={health.status === "ready" ? "success" : "error"} role="status">
      Trạng thái tổng: {health.status === "ready" ? "sẵn sàng" : "thiếu cấu hình bắt buộc"} · phiên bản {health.version} · kiểm tra lúc {new Date(health.checkedAt).toLocaleTimeString("vi-VN")}
      <button type="button" onClick={() => void reload()}><RefreshCw size={11}/>Kiểm tra lại</button>
    </p>
    <section className={styles.grid}>{health.services.map((service)=><article className={`${styles.card} ${styles.span4}`} key={service.key}><div className={styles.cardBody}><div className={styles.listItem}><span className={styles.listItemIcon}>{service.status === "ok" ? <CloudCog size={16}/> : <AlertTriangle size={16}/>}</span><div><strong>{service.label}</strong><small>{service.status === "ok" ? service.description : service.status === "error" ? "Đã cấu hình nhưng không kết nối được" : `Chưa cấu hình — ${service.description}`}</small></div><div className={styles.listItemMeta}><StatusBadge value={tone(service.status, service.required)}/></div></div></div></article>)}</section>
  </>;
}

export function OperationsCenterPage({ kind }: { kind: CenterKind }) {
  const store = useOperationsStore();
  if (kind === "admissions") return <><header className={styles.header}><div><span className={styles.eyebrow}>CRM & ADMISSIONS</span><h1>Pipeline tuyển sinh</h1><p>Theo dõi khách từ lần tương tác đầu tiên đến khi hoàn tất thanh toán, xếp lớp và cấp tài khoản học viên.</p></div></header><section className={styles.card}><div className={styles.cardBody}><AdmissionsPipeline/></div></section></>;

  const config = {
    support: { title: "Support Center", description: "Quản lý yêu cầu tài khoản, thanh toán, bài học và chính sách.", icon: LifeBuoy },
    approvals: { title: "Approval Center", description: "Một hàng đợi duyệt chung cho nội dung, thiết kế, tốt nghiệp và marketplace.", icon: CheckCheck },
    notifications: { title: "Notification Center", description: "Quản lý template và hiệu suất gửi email, Zalo, push, Telegram và in-app.", icon: BellRing },
    import: { title: "Data Import Center", description: "Import, mapping, preview, validate, commit và rollback dữ liệu cũ.", icon: FileInput },
    automation: { title: "Automation Center", description: "Kết nối sự kiện kinh doanh và đào tạo với hành động tự động.", icon: Workflow },
    product: { title: "Product Configuration", description: "Quản trị nội dung public site, catalog, giá, CTA và feature flags mà không sửa code.", icon: Settings2 },
    health: { title: "System Health", description: "Trạng thái thật của database, storage, queue, workers, email và payment.", icon: CloudCog }
  }[kind];

  return <><header className={styles.header}><div><span className={styles.eyebrow}>H2OBOOK OPERATIONS</span><h1>{config.title}</h1><p>{config.description}</p></div></header>
    {kind === "support" && <SupportTable/>}
    {kind === "approvals" && <ApprovalsTable/>}
    {kind === "notifications" && <><DemoNotice/><section className={styles.card}><div className={styles.cardBody}><div className={styles.list}>{store.notificationTemplates.map((item)=><div className={styles.listItem} key={item.id}><span className={styles.listItemIcon}><BellRing size={16}/></span><div><strong>{item.name}</strong><small>{item.eventKey} · {item.channels.join(" · ")}</small></div><div className={styles.listItemMeta}><StatusBadge value={item.enabled?"active":"paused"}/><em>{item.sentCount} gửi · {item.failureCount} lỗi</em></div><button className={`${styles.button} ${styles.buttonSecondary}`} onClick={()=>store.toggleNotificationTemplate(item.id)}>{item.enabled?"Tạm dừng":"Bật"}</button></div>)}</div></div></section></>}
    {kind === "import" && <><DemoNotice/><section className={styles.card}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>File</th><th>Loại</th><th>Dòng</th><th>Hợp lệ</th><th>Lỗi</th><th>Trạng thái</th><th/></tr></thead><tbody>{store.importJobs.map((job)=><tr key={job.id}><td><strong>{job.fileName}</strong><small>{job.createdBy}</small></td><td>{job.type}</td><td>{job.rowCount}</td><td>{job.validRows}</td><td>{job.invalidRows}</td><td><StatusBadge value={job.status}/></td><td><button className={`${styles.button} ${styles.buttonSecondary}`} onClick={()=>store.updateImportStatus(job.id,job.status==="completed"?"rolled_back":"completed")}>{job.status==="completed"?"Rollback":"Commit"}</button></td></tr>)}</tbody></table></div></section></>}
    {kind === "automation" && <><DemoNotice/><section className={styles.card}><div className={styles.cardBody}><div className={styles.list}>{store.automations.map((item)=><div className={styles.listItem} key={item.id}><span className={styles.listItemIcon}><Workflow size={16}/></span><div><strong>{item.name}</strong><small>{item.trigger} → {item.actions.join(" → ")}</small></div><div className={styles.listItemMeta}><StatusBadge value={item.status}/><em>{item.runCount} lượt · {item.errorCount} lỗi</em></div><button className={`${styles.button} ${styles.buttonSecondary}`} onClick={()=>store.toggleAutomation(item.id)}>{item.status==="active"?"Tạm dừng":"Kích hoạt"}</button></div>)}</div></div></section></>}
    {kind === "product" && <section className={styles.grid}><article className={`${styles.card} ${styles.span6}`}><div className={styles.cardHead}><div><h2>Public Academy</h2><p>Hero, sách nổi bật, khóa học, Strategy Hub, membership và SEO.</p></div><Settings2 size={18}/></div><div className={styles.cardBody}><div className={styles.list}>{["Homepage sections","Featured books","Featured courses","Membership plans","SEO & social preview"].map((item)=><div className={styles.listItem} key={item}><span className={styles.listItemIcon}><Settings2 size={16}/></span><strong>{item}</strong><StatusBadge value="active"/></div>)}</div></div></article><article className={`${styles.card} ${styles.span6}`}><div className={styles.cardHead}><div><h2>Feature Flags</h2><p>Bật/tắt an toàn mà không rollback database.</p></div></div><div className={styles.cardBody}><div className={styles.list}>{["Public Site V2","Student Experience V2","Global Neural Design","Knowledge Universe Hero","Operations Foundation"].map((item)=><div className={styles.listItem} key={item}><span className={styles.listItemIcon}><Play size={16}/></span><strong>{item}</strong><StatusBadge value="active"/></div>)}</div></div></article></section>}
    {kind === "health" && <HealthGrid/>}
  </>;
}
