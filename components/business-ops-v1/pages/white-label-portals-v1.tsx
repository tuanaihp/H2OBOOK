"use client";

import { useState, type CSSProperties } from "react";
import { Globe2, MonitorSmartphone, Palette, Plus, Settings2 } from "lucide-react";
import { demoPortals } from "@/lib/business-ops-v1/data";
import { emitBusinessEvent } from "@/lib/business-ops-v1/events";
import type { DemoPortal } from "@/lib/business-ops-v1/types";
import { BusinessPageHeader, BusinessPipelineBar, StatusBadge } from "../business-ops-shared";
import styles from "../business-ops-v1.module.css";

export function WhiteLabelPortalsV1() {
  const [portals, setPortals] = useState(demoPortals);
  const createPortal = () => {
    const portal: DemoPortal = { id: crypto.randomUUID(), name: "Portal mới", domain: "/portal-moi", books: 0, members: 0, plan: "academy", status: "draft", primary: "#6f1446", accent: "#65dce5" };
    setPortals((current) => [portal, ...current]);
    emitBusinessEvent({ name: "business_portal_updated", surface: "white-label", action: "create_portal", entityId: portal.id });
  };
  const toggle = (id: string) => setPortals((current) => current.map((portal) => portal.id === id ? { ...portal, status: portal.status === "active" ? "maintenance" : "active" } : portal));
  return <div className={styles.surface}><BusinessPageHeader eyebrow="WHITE-LABEL LEARNING PORTALS" title="Cổng thư viện thương hiệu riêng" description="Tạo website đọc sách theo domain, logo, màu, membership và thư viện của từng đối tác." actions={<button className={styles.primaryButton} onClick={createPortal}><Plus/>Tạo portal</button>}/><BusinessPipelineBar active="white-label"/><div className={styles.portalGrid}>{portals.map((portal) => <article className={styles.portalCard} key={portal.id}><div className={styles.portalPreview} style={{ "--portal-primary": portal.primary, "--portal-accent": portal.accent } as CSSProperties}><header><span>H2</span><strong>{portal.name}</strong><i/><i/><i/></header><div><small>THƯ VIỆN ĐÀO TẠO</small><h2>Kiến thức của bạn,<br/>thương hiệu của bạn.</h2><button>Khám phá thư viện</button></div><footer><b/><b/><b/></footer></div><div className={styles.portalBody}><div className={styles.rowBetween}><div><strong>{portal.name}</strong><small>{portal.domain}</small></div><StatusBadge status={portal.status}/></div><div className={styles.portalStats}><span><strong>{portal.books}</strong>Sách</span><span><strong>{portal.members}</strong>Thành viên</span><span><strong>{portal.plan}</strong>Gói</span></div><div className={styles.rowBetween}><span className={styles.colors}><Palette/><i style={{ background: portal.primary }}/><i style={{ background: portal.accent }}/></span><div className={styles.inlineActions}><button><Globe2/>Xem portal</button><button><MonitorSmartphone/>Đổi theme</button><button className={styles.primaryButton} onClick={() => toggle(portal.id)}><Settings2/>{portal.status === "active" ? "Bảo trì" : "Kích hoạt"}</button></div></div></div></article>)}</div></div>;
}
