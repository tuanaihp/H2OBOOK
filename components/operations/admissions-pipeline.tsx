"use client";

import { ArrowRight, CalendarClock, Phone } from "lucide-react";
import { useOperationsStore } from "@/store/operations-store";
import type { LeadStage } from "@/types/operations";
import styles from "./operations.module.css";

const stages: Array<{ id: LeadStage; label: string }> = [
  { id: "new", label: "Khách mới" }, { id: "contacted", label: "Đã liên hệ" }, { id: "consulted", label: "Đã tư vấn" },
  { id: "qualified", label: "Có nhu cầu" }, { id: "deposit", label: "Đặt cọc" }, { id: "paid", label: "Thanh toán" }, { id: "enrolled", label: "Nhập học" }
];

export function AdmissionsPipeline() {
  const leads = useOperationsStore((state) => state.leads);
  const moveLead = useOperationsStore((state) => state.moveLead);
  return <div className={styles.pipeline}>{stages.map((stage, index) => {
    const items = leads.filter((lead) => lead.stage === stage.id);
    const next = stages[index + 1]?.id;
    return <section key={stage.id} className={styles.pipelineColumn}><h3>{stage.label}<span>{items.length}</span></h3>{items.map((lead) => <article key={lead.id} className={styles.leadCard}><strong>{lead.name}</strong><p>{lead.interest}</p><footer><span><Phone size={10}/> {lead.phone}</span><span>{lead.source}</span></footer><div className={styles.leadActions}><button title="Lịch follow-up"><CalendarClock size={11}/></button>{next && <button onClick={() => moveLead(lead.id, next)} title={`Chuyển sang ${next}`}><ArrowRight size={11}/></button>}</div></article>)}</section>;
  })}</div>;
}
