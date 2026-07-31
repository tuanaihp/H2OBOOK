"use client";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { runtimeServices } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Notice, StatusBadge, SystemPageHeader } from "../system-shared";
import styles from "../system-governance-ops-v2.module.css";

export function IntegrationsV2() {
  return <>
    <SystemPageHeader eyebrow="PRODUCTION CONNECTIONS" title="Trung tâm tích hợp" description="Kiểm tra dịch vụ ngoài, biến môi trường bắt buộc và phần việc còn thiếu trước khi Production." actions={<button className={styles.secondaryButton} onClick={() => emitSystemEvent("system_connection_recheck_requested", { surface: "integrations" })}><RefreshCw/>Kiểm tra lại</button>}/>
    <Notice title="Chế độ hiện tại: Demo Local-first" tone="warning">Ứng dụng vẫn hoạt động bằng dữ liệu local; Production chỉ bật sau khi đủ cấu hình.</Notice>
    <div className={styles.integrationGrid}>{runtimeServices.map((service) => <article key={service.id} className={styles.integrationCard}><div className={styles.integrationIcon}><CheckCircle2/></div><div><strong>{service.name}</strong><p>{service.description}</p></div><StatusBadge status={service.status} label={service.status === "healthy" ? "Đã cấu hình" : service.required ? "Cần cấu hình" : "Tùy chọn"}/></article>)}</div>
    <section className={styles.panel}><header><div><h2>Thứ tự kết nối đề xuất</h2><p>Không cần thực hiện cùng lúc.</p></div></header><div className={styles.sequenceGrid}>{["Supabase: tạo project và chạy migration","Cloudflare R2: tạo bucket private và API token","Redis + document processor: khởi động worker","File Scanner: kết nối ClamAV","Email: Resend hoặc provider tương đương","Payment: checkout URL và webhook secret","Monitoring: Sentry hoặc OpenTelemetry"].map((step, index) => <div key={step}><span>{index + 1}</span><strong>{step}</strong></div>)}</div></section>
  </>;
}
