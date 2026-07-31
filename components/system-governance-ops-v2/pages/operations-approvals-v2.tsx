"use client";

import { useState } from "react";
import { Check, MessageSquareText, ShieldCheck, X } from "lucide-react";
import { approvalRequests as initialRequests } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Panel, SystemPageHeader } from "../system-shared";
import { OperationsStatus, OperationsTable, ProgressBar } from "../operations-shared";
import styles from "../system-governance-ops-v2.module.css";

export function OperationsApprovalsV2() {
  const [requests, setRequests] = useState(initialRequests);
  const decide = (id: string, decision: "approved" | "changes_requested") => {
    setRequests((items) => items.map((item) => item.id === id ? { ...item, status: decision } : item));
    emitSystemEvent("operations_approval_decided", { requestId: id, decision });
  };
  return <>
    <SystemPageHeader eyebrow="H2OBOOK OPERATIONS" title="Approval Center" description="Một hàng đợi duyệt chung cho nội dung, thiết kế, tốt nghiệp và marketplace." actions={<button className={styles.primaryButton}><ShieldCheck/> Tạo yêu cầu duyệt</button>}/>
    <Panel title="Hàng đợi phê duyệt" description="Quyết định được ghi audit và phát domain event." icon={<ShieldCheck/>}>
      <OperationsTable minWidth={900}><thead><tr><th>Yêu cầu</th><th>Người gửi</th><th>Rủi ro</th><th>Checklist</th><th>Trạng thái</th><th>Quyết định</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.title}</strong><small>{request.kind} · {request.createdAt}</small></td><td>{request.requester}</td><td><span className={`${styles.risk} ${styles[`risk_${request.risk}`]}`}>{request.risk}</span></td><td><ProgressBar value={Math.round((request.checklistDone / request.checklistTotal) * 100)}/><small>{request.checklistDone}/{request.checklistTotal}</small></td><td><OperationsStatus status={request.status === "approved" ? "completed" : request.status}/></td><td><div className={styles.rowActions}><button className={styles.secondaryButton} onClick={() => decide(request.id, "changes_requested")}><MessageSquareText/> Yêu cầu sửa</button><button className={styles.primaryButton} onClick={() => decide(request.id, "approved")}><Check/> Duyệt</button></div></td></tr>)}</tbody></OperationsTable>
    </Panel>
    <div className={styles.noticeStrip}><X/><span>Preview chỉ thay đổi state cục bộ. Route Production phải dùng server action, permission guard và audit log.</span></div>
  </>;
}
