"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Filter, Phone, Plus, Search, UserRoundCheck } from "lucide-react";
import { admissionLeads as initialLeads } from "@/lib/system-governance-ops-v2/data";
import type { AdmissionLead } from "@/lib/system-governance-ops-v2/types";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { SystemPageHeader } from "../system-shared";
import { OperationsStatus } from "../operations-shared";
import styles from "../system-governance-ops-v2.module.css";

const stages: AdmissionLead["stage"][] = ["new", "contacted", "consulted", "qualified", "deposit", "paid", "enrolled"];
const labels: Record<AdmissionLead["stage"], string> = { new: "Khách mới", contacted: "Đã liên hệ", consulted: "Đã tư vấn", qualified: "Có nhu cầu", deposit: "Đặt cọc", paid: "Đã thanh toán", enrolled: "Đã xếp lớp" };

export function OperationsAdmissionsV2() {
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => leads.filter((lead) => `${lead.name} ${lead.phone} ${lead.product}`.toLowerCase().includes(query.toLowerCase())), [leads, query]);
  const moveNext = (lead: AdmissionLead) => {
    const current = stages.indexOf(lead.stage);
    const next = stages[Math.min(stages.length - 1, current + 1)];
    setLeads((items) => items.map((item) => item.id === lead.id ? { ...item, stage: next } : item));
    emitSystemEvent("operations_lead_stage_changed", { leadId: lead.id, from: lead.stage, to: next });
  };
  return <>
    <SystemPageHeader eyebrow="CRM & ADMISSIONS" title="Pipeline tuyển sinh" description="Theo dõi khách từ lần tương tác đầu tiên đến khi hoàn tất thanh toán, xếp lớp và cấp tài khoản học viên." actions={<button className={styles.primaryButton}><Plus/> Thêm lead</button>}/>
    <div className={styles.opsToolbar}><label className={styles.opsSearch}><Search/><input value={query} onChange={(event: { target: { value: string } }) => setQuery(event.target.value)} placeholder="Tìm tên, số điện thoại, khóa học..."/></label><button className={styles.secondaryButton}><Filter/> Bộ lọc</button></div>
    <div className={styles.kanban}>
      {stages.map((stage) => <section key={stage} className={styles.kanbanColumn}><header><strong>{labels[stage]}</strong><span>{filtered.filter((lead) => lead.stage === stage).length}</span></header><div>
        {filtered.filter((lead) => lead.stage === stage).map((lead) => <article key={lead.id} className={styles.leadCard}><OperationsStatus status={lead.stage === "new" ? "new" : lead.stage === "enrolled" ? "completed" : "in_progress"} label={labels[lead.stage]}/><h3>{lead.name}</h3><p>{lead.product}</p><small><Phone/> {lead.phone}</small><small><UserRoundCheck/> {lead.owner}</small><small><CalendarClock/> {lead.nextActionAt}</small><footer><span>{lead.source}</span><button onClick={() => moveNext(lead)} aria-label="Chuyển giai đoạn"><ArrowRight/></button></footer></article>)}
      </div></section>)}
    </div>
  </>;
}
