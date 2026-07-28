"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { CheckCircle2, Database, Download, HardDrive, RefreshCcw, ShieldCheck, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export default function OfflinePage() {
  const store = useAppStore();
  const [online, setOnline] = useState(true);
  const [saved, setSaved] = useState("");
  useEffect(() => { const sync = () => setOnline(navigator.onLine); sync(); window.addEventListener("online", sync); window.addEventListener("offline", sync); return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); }; }, []);
  const backup = () => { const payload = JSON.stringify(store.exportData(), null, 2); const url = URL.createObjectURL(new Blob([payload], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `h2obook-v4-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); setSaved("Đã tạo backup đầy đủ trên thiết bị."); };
  return <AppShell>
    <section className="offline-hero"><div className={`offline-signal ${online ? "online" : "offline"}`}><WifiOff/><i/><i/><i/></div><div><span className="eyebrow">OFFLINE-FIRST</span><h1>{online ? "Đang có kết nối, nhưng H2OBOOK không phụ thuộc mạng." : "Bạn đang offline — vẫn có thể tiếp tục làm việc."}</h1><p>Sách, ghi chú, mục tiêu, flashcard và dữ liệu demo được lưu trên thiết bị. Cloud Sync chỉ là lớp sao lưu và đồng bộ bổ sung.</p></div></section>
    <div className="offline-grid">
      <article><HardDrive/><div><strong>Local Workspace</strong><span>{store.books.length} sách · {store.flashcards.length} flashcard</span></div><CheckCircle2/></article>
      <article><Database/><div><strong>Backup schema V4</strong><span>Giữ tương thích dữ liệu V2–V3</span></div><CheckCircle2/></article>
      <article><ShieldCheck/><div><strong>No-AI Core</strong><span>Không phát sinh token cho thao tác cốt lõi</span></div><CheckCircle2/></article>
    </div>
    <section className="section-card offline-actions"><div><h2>Backup thủ công</h2><p>Tải toàn bộ workspace thành một file JSON để lưu riêng hoặc chuyển máy.</p></div><button className="btn btn-primary" onClick={backup}><Download size={16}/>Tải backup V4</button>{saved && <span>{saved}</span>}</section>
    <section className="section-card offline-actions"><div><h2>Đồng bộ khi có mạng</h2><p>Production Mode có thể đẩy thay đổi lên Supabase và R2. Nếu chưa cấu hình, ứng dụng tiếp tục chạy local.</p></div><button className="btn btn-secondary" onClick={() => window.location.reload()}><RefreshCcw size={16}/>Kiểm tra lại</button></section>
  </AppShell>;
}
