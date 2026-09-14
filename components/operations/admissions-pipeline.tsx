"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Mail, Phone, RefreshCw, RotateCcw, UserPlus, XCircle } from "lucide-react";
import type { LeadStage } from "@/types/operations";
import type { LiveAdmissionLead } from "@/lib/operations/admission-leads";
import { useAdmissionLeads } from "./use-admission-leads";
import styles from "./operations.module.css";

const stages: Array<{ id: LeadStage; label: string }> = [
  { id: "new", label: "Khách mới" }, { id: "contacted", label: "Đã liên hệ" }, { id: "consulted", label: "Đã tư vấn" },
  { id: "qualified", label: "Có nhu cầu" }, { id: "deposit", label: "Đặt cọc" }, { id: "paid", label: "Thanh toán" }, { id: "enrolled", label: "Nhập học" },
  { id: "lost", label: "Không theo" }
];
const funnel = stages.filter((stage) => stage.id !== "lost");

export function AdmissionsPipeline() {
  const { mode, leads, error, busyLeadId, reload, moveLead, inviteLead } = useAdmissionLeads();
  const [notice, setNotice] = useState("");

  const invite = async (lead: LiveAdmissionLead) => {
    if (!window.confirm(`Tạo tài khoản học viên và gửi lời mời tới ${lead.email}?`)) return;
    setNotice("");
    const result = await inviteLead(lead.id);
    if (!result) return;
    const action = result.via === "application" ? "đã duyệt hồ sơ và cấp quyền học" : "đã tạo tài khoản học viên";
    setNotice(`${lead.name || lead.email}: ${action}. ${result.emailAccepted ? "Email mời đã được gửi." : "Email chưa gửi được — kiểm tra cấu hình EMAIL_PROVIDER."}`);
  };

  if (mode === "loading") return <div className={styles.empty}><Loader2 className={styles.spin}/><strong>Đang tải khách tuyển sinh…</strong></div>;

  return <>
    {mode === "demo" && <p className={styles.pipelineNotice}>Dữ liệu mẫu (demo) — thay đổi chỉ lưu trên trình duyệt này.</p>}
    {error && <p className={styles.pipelineNotice} data-tone="error" role="alert">{error}<button type="button" onClick={() => void reload()}><RefreshCw size={11}/>Tải lại</button></p>}
    {notice && <p className={styles.pipelineNotice} data-tone="success" role="status">{notice}</p>}
    {mode === "production" && !error && leads.length === 0 && <div className={styles.empty}><strong>Chưa có khách tuyển sinh</strong><p>Khách đăng ký trên trang học viện sẽ tự xuất hiện ở cột “Khách mới”.</p></div>}
    <div className={styles.pipeline}>{stages.map((stage) => {
      const items = leads.filter((lead) => lead.stage === stage.id);
      const position = funnel.findIndex((item) => item.id === stage.id);
      const previous = position > 0 && stage.id !== "enrolled" ? funnel[position - 1] : undefined;
      const next = position >= 0 ? funnel[position + 1] : undefined;
      return <section key={stage.id} className={styles.pipelineColumn}><h3>{stage.label}<span>{items.length}</span></h3>{items.map((lead) => {
        const busy = busyLeadId === lead.id;
        const disabled = Boolean(busyLeadId);
        const approvesApplication = Boolean(lead.applicationId && ["new", "approved"].includes(lead.applicationStatus ?? ""));
        return <article key={lead.id} className={styles.leadCard} aria-busy={busy}>
          <strong>{lead.name || lead.email || "Khách chưa đặt tên"}</strong>
          <p>{lead.interest}</p>
          <footer><span><Phone size={10}/> {lead.phone || "—"}</span><span>{lead.source}</span></footer>
          {lead.email && <footer><span><Mail size={10}/> {lead.email}</span></footer>}
          <div className={styles.leadActions}>
            {stage.id === "lost"
              ? <button type="button" disabled={disabled} onClick={() => void moveLead(lead.id, "new")} title="Mở lại khách này"><RotateCcw size={11}/>Mở lại</button>
              : <>
                {previous && <button type="button" disabled={disabled} onClick={() => void moveLead(lead.id, previous.id)} title={`Về “${previous.label}”`}><ArrowLeft size={11}/></button>}
                {next && <button type="button" disabled={disabled} onClick={() => void moveLead(lead.id, next.id)} title={`Chuyển sang “${next.label}”`}><ArrowRight size={11}/></button>}
                {stage.id !== "enrolled" && <button type="button" disabled={disabled} onClick={() => void moveLead(lead.id, "lost")} title="Đánh dấu không theo"><XCircle size={11}/></button>}
                {lead.canInvite && <button type="button" disabled={disabled} onClick={() => void invite(lead)} title={approvesApplication ? "Duyệt hồ sơ đăng ký và gửi lời mời" : "Tạo tài khoản học viên và gửi lời mời"}>{busy ? <Loader2 size={11} className={styles.spin}/> : <UserPlus size={11}/>}Duyệt → invite</button>}
              </>}
          </div>
        </article>;
      })}</section>;
    })}</div>
  </>;
}
