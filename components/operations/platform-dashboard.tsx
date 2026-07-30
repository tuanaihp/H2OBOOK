"use client";

import Link from "next/link";
import { Activity, Building2, CircleDollarSign, Database, HardDrive, UsersRound } from "lucide-react";
import { useOperationsStore } from "@/store/operations-store";
import { seedIncidents } from "@/lib/operations/data";
import { OperationsMetric } from "./metric-card";
import { StatusBadge } from "./status-badge";
import styles from "./operations.module.css";

export function PlatformDashboard() {
  const organizations = useOperationsStore((state) => state.organizations);
  const mrr = organizations.reduce((sum,item)=>sum+item.monthlyRevenue,0);
  const students = organizations.reduce((sum,item)=>sum+item.studentCount,0);
  return <>
    <header className={styles.header}><div><span className={styles.eyebrow}>H2OBOOK PLATFORM CONTROL</span><h1>Super Admin Command Center</h1><p>Quản lý organization, gói sử dụng, quota, tình trạng dịch vụ và rủi ro trên toàn nền tảng SaaS.</p></div><div className={styles.headerActions}><Link href="/platform-admin/organizations" className={`${styles.button} ${styles.buttonPrimary}`}>Quản lý organization</Link></div></header>
    <section className={styles.metrics}><OperationsMetric icon={Building2} value={organizations.length} label="Organizations"/><OperationsMetric icon={UsersRound} value={students} label="Học viên toàn nền tảng"/><OperationsMetric icon={CircleDollarSign} value={`${Math.round(mrr/1_000_000)}M`} label="MRR ghi nhận"/><OperationsMetric icon={Activity} value={seedIncidents.filter((item)=>item.status!=="resolved").length} label="Incident đang mở"/></section>
    <div className={styles.grid}><section className={`${styles.card} ${styles.span8}`}><div className={styles.cardHead}><div><h2>Organizations</h2><p>Gói, quota và sức khỏe tài khoản.</p></div><Link href="/platform-admin/organizations">Mở danh sách</Link></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Organization</th><th>Plan</th><th>Học viên</th><th>Storage</th><th>MRR</th><th>Trạng thái</th></tr></thead><tbody>{organizations.map((org)=><tr key={org.id}><td><strong>{org.name}</strong><small>{org.customDomain ?? org.slug}</small></td><td>{org.plan}</td><td>{org.studentCount}</td><td>{org.storageUsedGb}/{org.storageLimitGb} GB</td><td>{new Intl.NumberFormat("vi-VN").format(org.monthlyRevenue)} đ</td><td><StatusBadge value={org.status}/></td></tr>)}</tbody></table></div></section><section className={`${styles.card} ${styles.span4}`}><div className={styles.cardHead}><div><h2>Platform Services</h2><p>Trạng thái tóm tắt.</p></div><Database size={18}/></div><div className={styles.cardBody}><div className={styles.list}>{["Web & API","Supabase Database","Cloudflare R2","Redis Queue","Document Worker","Publishing Worker"].map((service,index)=><div className={styles.listItem} key={service}><span className={styles.listItemIcon}>{index===2?<HardDrive size={16}/>:<Database size={16}/>}</span><div><strong>{service}</strong><small>{index===4?"Đang theo dõi độ trễ":"Hoạt động bình thường"}</small></div><div className={styles.listItemMeta}><StatusBadge value={index===4?"monitoring":"active"}/></div></div>)}</div></div></section></div>
  </>;
}
