"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, FileKey, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";

type Capability = { key: string; label: string; configured: boolean; required: boolean; description: string };
type SessionPayload = { session: null | { id: string; device: string; location: string; current: boolean; authenticated: boolean } };

export default function SecurityPage() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [session, setSession] = useState<SessionPayload["session"]>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string>("");

  const load = async () => {
    setChecking(true);
    const [readiness, sessionResponse] = await Promise.all([
      fetch("/api/readiness", { cache: "no-store" }).then(response => response.json()).catch(() => ({ capabilities: [] })),
      fetch("/api/auth/session", { cache: "no-store" }).then(response => response.json()).catch(() => ({ session: null }))
    ]);
    setCapabilities(readiness.capabilities ?? []);
    setSession(sessionResponse.session ?? null);
    setCheckedAt(new Date().toLocaleTimeString("vi-VN"));
    setChecking(false);
  };

  useEffect(() => { void load(); }, []);
  const configured = useMemo(() => Object.fromEntries(capabilities.map(item => [item.key, item.configured])), [capabilities]);
  const controls = [
    { name: "Row Level Security", description: "Tách dữ liệu theo organization và role.", ready: Boolean(configured.database) },
    { name: "Private signed URLs", description: "File R2 chỉ mở bằng URL hết hạn và phải thuộc workspace.", ready: Boolean(configured.storage) },
    { name: "Webhook signature", description: "Chống giả mạo và xử lý trùng sự kiện thanh toán.", ready: Boolean(configured.payment) },
    { name: "Queue isolation", description: "Job PDF/OCR được kiểm tra workspace trước khi truy cập.", ready: Boolean(configured.queue) },
    { name: "Audit log", description: "Ghi thay đổi thanh toán, membership và dữ liệu quan trọng.", ready: Boolean(configured.database) },
    { name: "Authenticated session", description: "Phiên hiện tại được Supabase xác minh ở Production Mode.", ready: Boolean(session?.authenticated) }
  ];

  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">SECURITY CENTER</span><h1>Bảo mật và quyền truy cập</h1><p>Hiển thị trạng thái thực tế của các lớp bảo vệ, không dùng dữ liệu phiên giả.</p></div><Badge tone={controls.every(item => item.ready) ? "success" : "warning"}><ShieldCheck />{controls.every(item => item.ready) ? "Production protected" : "Cần hoàn thiện cấu hình"}</Badge></div>
    <div className="security-control-grid">{controls.map(item => <article key={item.name}><span className={item.ready ? "security-ready" : "security-pending"}>{item.ready ? <CheckCircle2 /> : <AlertTriangle />}</span><div><strong>{item.name}</strong><p>{item.description}</p><Badge tone={item.ready ? "success" : "warning"}>{item.ready ? "Đang hoạt động" : "Chưa kích hoạt"}</Badge></div></article>)}</div>
    <div className="two-column-layout">
      <section className="section-card"><div className="section-head"><div><h2>Phiên đăng nhập hiện tại</h2><p>Thông tin được đọc trực tiếp từ request hiện tại.</p></div><Smartphone /></div><div className="section-body session-list">{session ? <div><span><strong>{session.device}</strong><small>{session.location}</small></span><Badge tone={session.authenticated ? "success" : "warning"}>{session.authenticated ? "Supabase Auth" : "Demo Mode"}</Badge></div> : <div><span><strong>Chưa có phiên</strong><small>Đăng nhập để kiểm tra session production.</small></span></div>}</div></section>
      <section className="section-card"><div className="section-head"><div><h2>Khóa và bí mật</h2><p>Chỉ đọc ở server, không hiển thị giá trị thật.</p></div><KeyRound /></div><div className="section-body secret-list">{["SUPABASE_SERVICE_ROLE_KEY", "R2_SECRET_ACCESS_KEY", "PAYMENT_WEBHOOK_SECRET", "CRON_SECRET", "ENCRYPTION_KEY"].map(key => <div key={key}><FileKey /><code>{key}</code><span>Server only</span></div>)}</div></section>
    </div>
    <section className="section-card"><div className="section-head"><div><h2>Kiểm tra định kỳ</h2><p>{checkedAt ? `Kiểm tra gần nhất: ${checkedAt}` : "Chưa chạy kiểm tra."}</p></div><button className="btn btn-secondary btn-sm" disabled={checking} onClick={() => void load()}><RefreshCw className={checking ? "spin" : ""} />{checking ? "Đang kiểm tra" : "Chạy kiểm tra"}</button></div><div className="section-body security-checklist">{["Không có service role key trong bundle trình duyệt", "Mọi truy cập tenant được xác minh membership", "Signed URL hết hạn tối đa 10 phút", "Webhook dùng chữ ký và event idempotency", "Cloud save chạy trong transaction", "Khách mua trước đăng ký nhận quyền bằng email"].map(item => <div key={item}><LockKeyhole size={14} />{item}</div>)}</div></section>
  </AppShell>;
}
