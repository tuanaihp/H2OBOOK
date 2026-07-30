"use client";

import Link from "next/link";
import { CheckCircle2, CircleDollarSign, FileText, GraduationCap } from "lucide-react";
import { useOperationsStore } from "@/store/operations-store";
import { OperationsMetric } from "./metric-card";
import styles from "./operations.module.css";

export function CustomerDashboard() {
  const application = useOperationsStore((state) => state.applications[0]);
  if (!application) return null;
  const done = application.documents.filter((item) => item.status === "verified").length;
  return <>
    <section className={styles.customerHero}><div><span className={styles.eyebrow}>HỒ SƠ ĐĂNG KÝ CỦA BẠN</span><h1>Chào {application.customerName}</h1><p>H2OBOOK đang đồng hành cùng bạn từ bước đăng ký, hoàn thiện hồ sơ, thanh toán đến khi chính thức bước vào không gian học viên.</p><Link className={`${styles.button} ${styles.buttonPrimary}`} href="/customer/onboarding">Tiếp tục hoàn thiện hồ sơ</Link></div><div className={styles.customerStatus}><small>Tiến độ onboarding</small><strong>{application.profileCompletion}%</strong><div className={styles.progress}><i style={{width:`${application.profileCompletion}%`}}/></div><small>{application.programName}</small></div></section>
    <section className={styles.metrics} style={{marginTop:18}}><OperationsMetric icon={FileText} value={`${done}/${application.documents.length}`} label="Tài liệu đã xác minh"/><OperationsMetric icon={CircleDollarSign} value={application.paymentStatus === "paid" ? "Đã đủ" : application.paymentStatus === "deposit" ? "Đã cọc" : "Chưa thanh toán"} label="Trạng thái học phí"/><OperationsMetric icon={GraduationCap} value={application.className ?? "Chờ xếp lớp"} label="Lớp dự kiến"/><OperationsMetric icon={CheckCircle2} value={application.accountProvisioned ? "Đã cấp" : "Đang chờ"} label="Tài khoản học viên"/></section>
  </>;
}
