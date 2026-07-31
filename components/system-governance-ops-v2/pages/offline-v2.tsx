"use client";
import { Download, HardDrive, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Metric, Panel, SystemPageHeader } from "../system-shared";
import styles from "../system-governance-ops-v2.module.css";

export function OfflineV2() {
  return <>
    <section className={styles.darkHero}><div className={styles.orb}><WifiOff/></div><div><span>OFFLINE-FIRST</span><h1>Đang có kết nối, nhưng H2OBOOK không phụ thuộc mạng.</h1><p>Sách, ghi chú, mục tiêu, flashcard và dữ liệu demo được lưu trên thiết bị. Cloud Sync là lớp sao lưu bổ sung.</p></div></section>
    <div className={styles.metricGrid}><Metric label="Local Workspace" value="3 sách" note="3 flashcard · 2 mục tiêu" tone="success" icon={<HardDrive/>}/><Metric label="Backup schema" value="V4" note="Giữ tương thích dữ liệu V2–V3" tone="success"/><Metric label="No-AI Core" value="Sẵn sàng" note="Không phát sinh token core" tone="success" icon={<ShieldCheck/>}/><Metric label="Sync queue" value="0" note="Không có thay đổi chờ gửi" tone="blue"/></div>
    <div className={styles.twoColumn}><Panel title="Backup thủ công" description="Tải workspace thành JSON để lưu riêng hoặc chuyển máy."><div className={styles.bigAction}><Download/><div><strong>Tải backup V4</strong><small>Không chứa server secret hoặc signed URL hết hạn.</small></div><button className={styles.primaryButton} onClick={() => emitSystemEvent("system_action_clicked", { surface: "offline", action: "download_backup" })}>Tải xuống</button></div></Panel><Panel title="Đồng bộ khi có mạng" description="Production có thể đẩy thay đổi lên Supabase và R2."><div className={styles.bigAction}><RefreshCw/><div><strong>Kiểm tra thay đổi local</strong><small>Preview diff trước khi sync.</small></div><button className={styles.secondaryButton}>Kiểm tra lại</button></div></Panel></div>
  </>;
}
