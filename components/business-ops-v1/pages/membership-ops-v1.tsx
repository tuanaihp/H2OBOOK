"use client";

import { useState } from "react";
import { Crown, Database, Library, Users } from "lucide-react";
import { demoMemberships } from "@/lib/business-ops-v1/data";
import { emitBusinessEvent } from "@/lib/business-ops-v1/events";
import { BusinessPageHeader, BusinessPipelineBar, Metric, Panel, StatusBadge, formatVnd } from "../business-ops-shared";
import styles from "../business-ops-v1.module.css";

const plans = [
  { id: "creator", name: "Creator", monthly: 299000, annual: 2990000, books: "3 sách", storage: "2 GB", students: "100 học viên" },
  { id: "academy", name: "Academy Pro", monthly: 899000, annual: 8990000, books: "20 sách", storage: "25 GB", students: "500 học viên" },
  { id: "white-label", name: "Business White-label", monthly: 2499000, annual: 24990000, books: "Không giới hạn", storage: "100 GB", students: "Không giới hạn" },
];

export function MembershipOpsV1() {
  const [cycle, setCycle] = useState<"month" | "year">("month");
  return <div className={styles.surface}><BusinessPageHeader eyebrow="SUBSCRIPTION, ACCESS & QUOTA" title="Membership H2OBOOK" description="Quản lý plan nền tảng, subscription học viên, quota và entitlement định kỳ." actions={<div className={styles.segmented}><button onClick={() => setCycle("month")} className={cycle === "month" ? styles.segmentedActive : ""}>Theo tháng</button><button onClick={() => setCycle("year")} className={cycle === "year" ? styles.segmentedActive : ""}>Theo năm</button></div>}/><BusinessPipelineBar active="membership"/><div className={styles.usageBanner}><span><Crown/></span><div><small>Gói đang sử dụng</small><strong>Academy Pro</strong><p>Gia hạn tiếp theo vào 27/08/2026</p></div><div className={styles.usageStats}><span><b>3/20</b>Sách</span><span><b>5/500</b>Học viên</span><span><b>1.8/25 GB</b>Lưu trữ</span></div><button className={styles.secondaryButton}>Quản lý thanh toán</button></div><div className={styles.planGrid}>{plans.map((plan) => <article className={`${styles.planCard} ${plan.id === "academy" ? styles.planRecommended : ""}`} key={plan.id}>{plan.id === "academy" ? <span className={styles.recommended}>Khuyên dùng</span> : null}<h2>{plan.name}</h2><strong>{formatVnd(cycle === "month" ? plan.monthly : plan.annual)}</strong><small>/ {cycle === "month" ? "tháng" : "năm"}</small><ul><li><Library/>{plan.books}</li><li><Database/>{plan.storage}</li><li><Users/>{plan.students}</li></ul><button className={plan.id === "academy" ? styles.softButton : styles.secondaryButton} onClick={() => emitBusinessEvent({ name: "business_action_clicked", surface: "membership", action: "select_plan", entityId: plan.id, metadata: { cycle } })}>{plan.id === "academy" ? "Đang sử dụng" : "Chọn gói"}</button></article>)}</div><Panel title="Membership học viên" description="Subscription đang cấp quyền vào thư viện nội dung."><div className={styles.tableWrap}><table><thead><tr><th>Thành viên</th><th>Gói</th><th>Chu kỳ</th><th>Giá trị</th><th>Gia hạn</th><th>Trạng thái</th></tr></thead><tbody>{demoMemberships.map((membership) => <tr key={membership.id}><td><strong>{membership.member}</strong></td><td>{membership.plan}</td><td>{membership.cycle === "month" ? "Hàng tháng" : "Hàng năm"}</td><td>{formatVnd(membership.value)}</td><td>{membership.renewsAt}</td><td><StatusBadge status={membership.status}/></td></tr>)}</tbody></table></div></Panel></div>;
}
