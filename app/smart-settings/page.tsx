"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { Accessibility, Brain, CloudOff, Cpu, Eye, Gauge, ShieldCheck, Sparkles, WifiOff } from "lucide-react";

export default function SmartSettingsPage() {
  const store = useAppStore();
  const settings = store.smartSettings;
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">NO-AI-FIRST ARCHITECTURE</span><h1>Smart Core Settings</h1><p>AI mặc định tắt. Toàn bộ chức năng chính của H2OBOOK vẫn hoạt động bằng local engine, quy tắc và dữ liệu của người dùng.</p></div><div className="header-actions"><span className="core-status-pill"><ShieldCheck size={14}/>Core độc lập AI</span></div></div>
    <section className="core-principle-banner"><div><Cpu/><span><strong>Core Engine</strong><small>Editor · Reader · Quiz · Flashcard · Search · Preflight · Store</small></span></div><div className="core-divider"/><div><Sparkles/><span><strong>Optional Assist</strong><small>Chỉ bật khi chủ workspace chủ động kết nối model/API</small></span></div></section>
    <div className="settings-v4-grid">
      <section className="section-card"><div className="section-head"><div><h2>Chế độ vận hành</h2><p>Các thiết lập ảnh hưởng toàn bộ ứng dụng.</p></div></div><div className="section-body setting-switch-list">
        <SettingToggle icon={WifiOff} title="Offline-first" description="Ưu tiên dữ liệu local và tiếp tục làm việc khi mất mạng." checked={settings.offlineFirst} onChange={(checked) => store.updateSmartSettings({ offlineFirst: checked })}/>
        <SettingToggle icon={Brain} title="Tạo thẻ học local" description="Sinh flashcard bằng thuật toán local, không dùng token." checked={settings.autoGenerateStudyCards} onChange={(checked) => store.updateSmartSettings({ autoGenerateStudyCards: checked })}/>
        <SettingToggle icon={Sparkles} title="Cho phép AI tùy chọn" description="Tắt mặc định. Bật chỉ khi đã cấu hình AI Gateway riêng." checked={settings.aiEnabled} onChange={(checked) => store.updateSmartSettings({ aiEnabled: checked, assistMode: checked ? "external" : "local" })}/>
      </div></section>
      <section className="section-card"><div className="section-head"><div><h2>Khả năng tiếp cận</h2><p>Giao diện thích nghi theo nhu cầu sử dụng.</p></div></div><div className="section-body setting-switch-list">
        <SettingToggle icon={Gauge} title="Giảm chuyển động" description="Giảm animation và hiệu ứng chuyển cảnh." checked={settings.reduceMotion} onChange={(checked) => store.updateSmartSettings({ reduceMotion: checked })}/>
        <SettingToggle icon={Eye} title="Tương phản cao" description="Tăng độ rõ của chữ, viền và trạng thái." checked={settings.highContrast} onChange={(checked) => store.updateSmartSettings({ highContrast: checked })}/>
        <SettingToggle icon={Accessibility} title="Focus mode" description="Ẩn bớt điều hướng phụ để tập trung vào nội dung." checked={settings.focusMode} onChange={(checked) => store.updateSmartSettings({ focusMode: checked })}/>
      </div></section>
    </div>
    <section className="no-ai-proof"><CloudOff/><div><h2>Khi không có AI hoặc mất kết nối API</h2><p>H2OBOOK vẫn cho phép tạo sách, dàn trang, import tài liệu, clone thương hiệu, xuất bản, đọc offline, tạo quiz thủ công, dùng flashcard local, quản lý lớp, bán sách và theo dõi tiến độ.</p></div></section>
  </AppShell>;
}

function SettingToggle({ icon: Icon, title, description, checked, onChange }: { icon: typeof Sparkles; title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label><span className="setting-icon"><Icon size={17}/></span><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><i/></label>;
}
