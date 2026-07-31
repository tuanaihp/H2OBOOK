"use client";
import { KeyRound, LockKeyhole, MonitorSmartphone, RefreshCw, ShieldAlert } from "lucide-react";
import { securityControls } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Panel, StatusBadge, SystemPageHeader } from "../system-shared";
import styles from "../system-governance-ops-v2.module.css";

export function SecurityV2() {
  const secretNames = ["SUPABASE_SERVICE_ROLE_KEY", "R2_SECRET_ACCESS_KEY", "PAYMENT_WEBHOOK_SECRET", "CRON_SECRET", "ENCRYPTION_KEY"];
  return <>
    <SystemPageHeader eyebrow="SECURITY CENTER" title="Bảo mật và quyền truy cập" description="Hiển thị trạng thái thực tế của các lớp bảo vệ; không render giá trị bí mật trong trình duyệt." actions={<button className={styles.secondaryButton} onClick={() => emitSystemEvent("system_security_check_requested", { surface: "security" })}><RefreshCw/>Chạy kiểm tra</button>}/>
    <div className={styles.securityGrid}>{securityControls.map((control) => <article key={control.id}><ShieldAlert/><div><strong>{control.name}</strong><p>{control.description}</p><StatusBadge status={control.status} label={control.status === "active" ? "Đã kích hoạt" : control.status === "missing" ? "Chưa kích hoạt" : "Cần kiểm tra"}/></div></article>)}</div>
    <div className={styles.twoColumn}><Panel title="Phiên đăng nhập hiện tại" description="Thông tin tối thiểu từ request hiện tại." icon={<MonitorSmartphone/>}><div className={styles.sessionCard}><strong>Chrome trên Windows</strong><small>Hải Phòng · không thu thập vị trí chính xác</small><StatusBadge status="warning" label="Demo Mode"/></div></Panel><Panel title="Khóa và bí mật" description="Chỉ hiển thị tên biến; server tự kiểm tra tồn tại." icon={<KeyRound/>}><div className={styles.secretList}>{secretNames.map((name) => <div key={name}><LockKeyhole/><code>{name}</code><small>Server only</small></div>)}</div></Panel></div>
    <Panel title="Kiểm tra định kỳ" description="Các test bắt buộc trước khi deploy Production."><div className={styles.checkGrid}>{["Không có service role key trong browser bundle","Mọi tenant route xác minh membership","Signed URL hết hạn tối đa 10 phút","Webhook đúng chữ ký và idempotency","Cloud save chạy trong transaction","Khách mua trước đăng ký nhận quyền bằng email"].map((item) => <div key={item}><LockKeyhole/><span>{item}</span></div>)}</div></Panel>
  </>;
}
