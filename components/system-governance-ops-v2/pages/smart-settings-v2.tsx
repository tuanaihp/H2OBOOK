"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import { Accessibility, BrainCircuit, Eye, Gauge, ShieldCheck, Sparkles, WifiOff } from "lucide-react";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { SystemPageHeader } from "../system-shared";
import styles from "../system-governance-ops-v2.module.css";

export function SmartSettingsV2() {
  const [settings, setSettings] = useState({ offline: true, flashcards: true, ai: false, motion: false, contrast: false, focus: false });
  const toggle = (key: keyof typeof settings) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  const row = (key: keyof typeof settings, title: string, description: string, icon: ReactNode) => <button className={styles.settingRow} onClick={() => toggle(key)}>{icon}<span><strong>{title}</strong><small>{description}</small></span><i className={settings[key] ? styles.switchOn : styles.switchOff}><b/></i></button>;
  return <>
    <SystemPageHeader eyebrow="NO-AI-FIRST ARCHITECTURE" title="Smart Core Settings" description="AI mặc định tắt; Editor, Reader, Quiz, Flashcard, Search, Preflight và Store vẫn hoạt động bằng local engine." actions={<span className={styles.heroPill}><ShieldCheck/>Core độc lập AI</span>}/>
    <div className={styles.segmentTabs}><button className={styles.segmentActive}><BrainCircuit/>Core Engine</button><button><Sparkles/>Optional Assist</button></div>
    <div className={styles.twoColumn}><section className={styles.panel}><header><div><h2>Chế độ vận hành</h2><p>Các thiết lập ảnh hưởng toàn bộ ứng dụng.</p></div></header><div className={styles.settingsList}>{row("offline", "Offline-first", "Ưu tiên dữ liệu local khi mất mạng.", <WifiOff/>)}{row("flashcards", "Tạo thẻ học local", "Không dùng token để sinh lịch ôn.", <BrainCircuit/>)}{row("ai", "Cho phép AI tùy chọn", "Chỉ bật khi đã cấu hình gateway.", <Sparkles/>)}</div></section><section className={styles.panel}><header><div><h2>Khả năng tiếp cận</h2><p>Điều chỉnh giao diện theo nhu cầu sử dụng.</p></div><Accessibility/></header><div className={styles.settingsList}>{row("motion", "Giảm chuyển động", "Giảm animation và hiệu ứng chuyển cảnh.", <Gauge/>)}{row("contrast", "Tương phản cao", "Tăng độ rõ của chữ, viền và trạng thái.", <Eye/>)}{row("focus", "Focus mode", "Ẩn bớt điều hướng phụ để tập trung.", <Accessibility/>)}</div></section></div>
    <section className={styles.darkNotice}><WifiOff/><div><h2>Khi không có AI hoặc mất kết nối API</h2><p>H2OBOOK vẫn cho phép tạo sách, dàn trang, import tài liệu, clone thương hiệu, xuất bản, đọc offline, tạo quiz thủ công, dùng flashcard local và quản lý lớp.</p></div><button className={styles.softButton} onClick={() => emitSystemEvent("system_policy_saved", { surface: "smart-settings", settings })}>Lưu Smart Core</button></section>
  </>;
}
