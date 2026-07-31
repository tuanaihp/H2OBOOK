"use client";
import { useState } from "react";
import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck, UserCircle2 } from "lucide-react";
import { Metric, Panel, StatusBadge, SystemPageHeader } from "../system-shared";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import styles from "../system-governance-ops-v2.module.css";

export function AccountV2() {
  const [twoFactor, setTwoFactor] = useState(false);
  return <>
    <SystemPageHeader eyebrow="MY ACCOUNT" title="Tài khoản cá nhân" description="Quản lý danh tính, vai trò, phiên đăng nhập và bảo mật cá nhân trong một nơi." actions={<button className={styles.secondaryButton} onClick={() => emitSystemEvent("system_action_clicked", { surface: "account", action: "logout" })}><LogOut/>Đăng xuất</button>}/>
    <div className={styles.heroCard}><div className={styles.avatar}><UserCircle2/></div><div><h2>Thủy H2O</h2><p>owner@h2obook.local</p><div className={styles.inlineActions}><StatusBadge status="active" label="owner"/><StatusBadge status="warning" label="Local-first"/></div></div><div className={styles.heroMeta}><small>Workspace</small><strong>ThuyH2O Makeup Academy</strong><small>Vai trò hiệu lực</small><strong>Workspace Owner</strong></div></div>
    <div className={styles.metricGrid}><Metric label="Phiên hoạt động" value="2" note="Chrome Windows · Mobile PWA" icon={<MonitorSmartphone/>}/><Metric label="Vai trò" value="1" note="Owner · toàn quyền workspace" tone="blue" icon={<ShieldCheck/>}/><Metric label="2FA" value={twoFactor ? "Bật" : "Tắt"} note="Khuyến nghị bật cho owner" tone={twoFactor ? "success" : "warning"} icon={<KeyRound/>}/><Metric label="Lần đăng nhập cuối" value="07:42" note="31/07/2026 · Hải Phòng"/></div>
    <div className={styles.twoColumn}><Panel title="Hồ sơ và bảo mật" description="Thông tin cá nhân chỉ được cập nhật qua server action."><div className={styles.formGrid}><label>Họ và tên<input defaultValue="Thủy H2O"/></label><label>Email<input defaultValue="owner@h2obook.local"/></label><label>Số điện thoại<input defaultValue="0900 000 000"/></label><label>Ngôn ngữ<select defaultValue="vi"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label></div><div className={styles.panelActions}><button className={styles.primaryButton} onClick={() => emitSystemEvent("system_policy_saved", { surface: "account", target: "profile" })}>Lưu hồ sơ</button></div></Panel><Panel title="Bảo vệ tài khoản" description="Bật thêm lớp xác minh cho các thao tác nhạy cảm."><div className={styles.switchRow}><span><strong>Xác thực hai bước</strong><small>Yêu cầu OTP khi đăng nhập trên thiết bị mới.</small></span><input type="checkbox" checked={twoFactor} onChange={(event) => setTwoFactor(event.target.checked)}/></div><div className={styles.listRows}><div><KeyRound/><span><strong>Đổi mật khẩu</strong><small>Cập nhật qua Supabase Auth.</small></span><button className={styles.softButton}>Mở</button></div><div><MonitorSmartphone/><span><strong>Quản lý phiên</strong><small>Thu hồi các phiên không còn sử dụng.</small></span><button className={styles.softButton}>Xem</button></div></div></Panel></div>
  </>;
}
