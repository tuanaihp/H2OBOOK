"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, BookOpen, CheckCheck, Command, HelpCircle, Search, X } from "lucide-react";
import { useAppStore } from "@/store/app-store";

export function Topbar() {
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const store = useAppStore();
  const unread = store.notifications.filter((notice) => !notice.read).length;
  const results = useMemo(() => {
    const value = query.trim().toLowerCase(); if (!value) return [];
    return [
      ...store.books.filter((book) => `${book.title} ${book.subtitle}`.toLowerCase().includes(value)).slice(0, 5).map((book) => ({ id: book.id, label: book.title, meta: "Sách", href: `/editor/${book.id}` })),
      ...store.students.filter((student) => `${student.name} ${student.email}`.toLowerCase().includes(value)).slice(0, 4).map((student) => ({ id: student.id, label: student.name, meta: "Học viên", href: "/students" })),
      ...store.templates.filter((template) => template.name.toLowerCase().includes(value)).slice(0, 4).map((template) => ({ id: template.id, label: template.name, meta: "Template", href: "/templates" }))
    ].slice(0, 8);
  }, [query, store.books, store.students, store.templates]);

  return <header className="topbar">
    <div className="topbar-search-wrap"><div className="search-box"><Search size={17}/><input value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder="Tìm sách, template, học viên..."/><kbd><Command size={11}/>K</kbd></div>
      {searchOpen && query && <div className="global-search-results"><div className="search-result-head"><span>Kết quả tìm kiếm</span><button onClick={() => setSearchOpen(false)}><X size={13}/></button></div>{results.length ? results.map((result) => <Link key={`${result.meta}-${result.id}`} href={result.href} onClick={() => setSearchOpen(false)}><span className="result-icon"><BookOpen size={14}/></span><span><strong>{result.label}</strong><small>{result.meta}</small></span></Link>) : <p>Không tìm thấy kết quả phù hợp.</p>}</div>}
    </div>
    <div className="top-actions">
      <Link className="icon-btn" aria-label="Trợ giúp và cài đặt" href="/settings" title="Trợ giúp và cài đặt"><HelpCircle size={18}/></Link>
      <div className="notification-wrap"><button className="icon-btn" aria-label="Thông báo" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18}/>{unread > 0 && <span className="notification-dot">{unread}</span>}</button>
        {notificationsOpen && <div className="notification-popover"><header><div><strong>Thông báo</strong><span>{unread} chưa đọc</span></div><button onClick={store.markAllNotificationsRead}><CheckCheck size={14}/>Đọc tất cả</button></header><div>{store.notifications.map((notice) => <Link key={notice.id} href={notice.href} className={notice.read ? "read" : "unread"} onClick={() => { store.markNotificationRead(notice.id); setNotificationsOpen(false); }}><span className={`notice-type notice-${notice.type}`}/><span><strong>{notice.title}</strong><small>{notice.message}</small><time>{new Date(notice.createdAt).toLocaleDateString("vi-VN")}</time></span></Link>)}</div></div>}
      </div>
      <Link href="/account" className="user-pill"><div className="user-avatar">TH</div><div className="user-meta"><strong>{store.workspace.ownerName}</strong><span>Workspace Owner</span></div></Link>
    </div>
  </header>;
}
