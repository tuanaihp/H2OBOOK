"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

type Notification = { id: string; title: string; message: string; href: string | null; readAt: string | null; createdAt: string };

// Real notifications (2026-08-14) — the bell used to show a hardcoded "2" (<i>2</i> in the JSX
// literal), not real data, and the `notifications` table (migration 0002, real RLS) had no reader or
// writer anywhere in the app. Admin-granted Stage/Membership/Course access
// (lib/academy-admin/entitlements.ts) now writes here; this reads it for real.
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/student/notifications", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setNotifications(json?.notifications ?? []);
    setUnreadCount(json?.unreadCount ?? 0);
    setLoaded(true);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function openNotification(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
      void fetch("/api/student/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "read", notificationId: n.id }) });
    }
    if (n.href) router.push(n.href);
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    await fetch("/api/student/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "read_all" }) });
  }

  return <div ref={containerRef} style={{ position: "relative" }}>
    <button className="h2o-student-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Thông báo"><Bell />{unreadCount > 0 && <i>{unreadCount > 9 ? "9+" : unreadCount}</i>}</button>
    {open && <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340, maxHeight: 420, overflowY: "auto", background: "#fff", borderRadius: 12, border: "1px solid #e5e9ee", boxShadow: "0 12px 32px rgba(15,23,42,0.14)", zIndex: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #eef1f4" }}>
        <strong style={{ fontSize: 13 }}>Thông báo</strong>
        {unreadCount > 0 && <button onClick={markAllRead} style={{ border: "none", background: "none", color: "#2563eb", fontSize: 11, cursor: "pointer" }}>Đánh dấu đã đọc hết</button>}
      </div>
      {!loaded ? <p style={{ padding: 14, fontSize: 12, color: "#8d97a6" }}>Đang tải…</p>
        : !notifications.length ? <p style={{ padding: 14, fontSize: 12, color: "#8d97a6" }}>Chưa có thông báo nào.</p>
        : notifications.map((n) => <button key={n.id} onClick={() => openNotification(n)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid #f5f6f8", background: n.readAt ? "#fff" : "#eff6ff", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {!n.readAt && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", flexShrink: 0 }} />}
              <strong style={{ fontSize: 12 }}>{n.title}</strong>
            </div>
            <p style={{ fontSize: 11, color: "#5b6674", margin: "3px 0 0" }}>{n.message}</p>
            <small style={{ fontSize: 10, color: "#9aa4b2" }}>{new Date(n.createdAt).toLocaleString("vi-VN")}</small>
          </button>)}
    </div>}
  </div>;
}
