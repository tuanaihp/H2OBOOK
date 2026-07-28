"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Brain, Command, GraduationCap, LayoutDashboard, LibraryBig, Search, Settings2, Sparkles, WandSparkles, X } from "lucide-react";
import { useAppStore } from "@/store/app-store";

const staticActions = [
  { label: "Mở Smart Home", hint: "Điều hành và tiếp tục công việc", href: "/dashboard", icon: LayoutDashboard },
  { label: "Hành trình học", hint: "Mục tiêu, tiến độ và thói quen", href: "/learn", icon: GraduationCap },
  { label: "Ôn tập thông minh", hint: "Flashcard và lịch ôn local", href: "/study", icon: Brain },
  { label: "Không gian tri thức", hint: "Sách, ghi chú và nguồn tài liệu", href: "/knowledge", icon: LibraryBig },
  { label: "Smart Tools", hint: "Công cụ local, AI là tùy chọn", href: "/ai-studio", icon: WandSparkles },
  { label: "Cài đặt Smart Core", hint: "Offline, AI và accessibility", href: "/smart-settings", icon: Settings2 }
];

export function CommandCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const books = useAppStore((state) => state.books);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 30); }, [open]);
  useEffect(() => setOpen(false), [pathname]);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const dynamic = books.map((book) => ({ label: book.title, hint: "Mở trong H2OBOOK Studio", href: `/editor/${book.id}`, icon: BookOpen }));
    return [...staticActions, ...dynamic].filter((item) => !needle || `${item.label} ${item.hint}`.toLowerCase().includes(needle)).slice(0, 10);
  }, [books, query]);
  const execute = () => {
    const first = results[0];
    if (first) { router.push(first.href); setOpen(false); setQuery(""); }
  };
  return <>
    <button className="quantum-command-trigger" onClick={() => setOpen(true)} title="Mở Command Center (Ctrl/⌘ K)"><Sparkles size={15}/><span>Điều hướng hoặc tạo nhanh</span><kbd><Command size={10}/>K</kbd></button>
    {open && <div className="command-overlay" role="dialog" aria-modal="true" aria-label="H2OBOOK Command Center" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section className="command-panel">
        <header><Search size={19}/><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") execute(); }} placeholder="Tìm sách, mở chức năng hoặc bắt đầu học..."/><button onClick={() => setOpen(false)}><X size={17}/></button></header>
        <div className="command-caption"><span>Smart Core hoạt động không cần AI</span><span>Enter để mở</span></div>
        <div className="command-results">{results.map(({ label, hint, href, icon: Icon }) => <Link key={`${href}-${label}`} href={href}><span className="command-result-icon"><Icon size={17}/></span><span><strong>{label}</strong><small>{hint}</small></span></Link>)}</div>
      </section>
    </div>}
  </>;
}
