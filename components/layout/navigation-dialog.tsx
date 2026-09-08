"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, Search, X } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import styles from "./navigation-dialog.module.css";

export interface NavigationEntry { href: string; label: string; group?: string }
export function normalizeNavigationText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
}

/** Native dialog supplies modal focus containment, Escape and focus restoration. */
export function NavigationDialog({ entries, kind = "search" }: { entries: NavigationEntry[]; kind?: "search" | "menu" }) {
  const { locale } = useLocale();
  const l = (vi: string, en: string) => locale === "vi" ? vi : en;
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const close = () => { ref.current?.close(); setOpen(false); };
  useEffect(() => { ref.current?.close(); setOpen(false); }, [pathname]);
  useEffect(() => {
    if (kind !== "search") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (ref.current?.open) { ref.current.close(); setOpen(false); }
        else { setQuery(""); ref.current?.showModal(); setOpen(true); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind]);
  const needle = normalizeNavigationText(query.trim());
  const results = entries.filter(item => normalizeNavigationText(item.label + " " + (item.group ?? "")).includes(needle));
  const label = kind === "menu" ? l("Menu điều hướng", "Navigation menu") : l("Tìm chức năng…", "Find a feature…");
  return <>
    <button type="button" className={kind === "menu" ? styles.menu : styles.trigger} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(""); ref.current?.showModal(); setOpen(true); }}>
      {kind === "menu" ? <Menu size={19}/> : <><Search size={17}/><span>{label}</span><kbd>Ctrl K</kbd></>}
    </button>
    <dialog ref={ref} className={styles.dialog} aria-label={label} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.body}>
        <header><Search size={19}/><input autoFocus aria-label={l("Tìm trong điều hướng", "Search navigation")} placeholder={l("Nhập tên chức năng, có hoặc không dấu", "Search by feature name")} value={query} onChange={event=>setQuery(event.target.value)}/><button type="button" aria-label={l("Đóng", "Close")} onClick={close}><X size={18}/></button></header>
        <nav aria-label={l("Kết quả điều hướng", "Navigation results")}>{results.map(item=><Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={close}><div><strong>{item.label}</strong>{item.group && <small>{item.group}</small>}</div><ArrowRight size={16}/></Link>)}</nav>
        {!results.length && <p role="status">{l("Không tìm thấy chức năng phù hợp. Thử từ khóa khác.", "No matching features. Try another keyword.")}</p>}
        <footer>{l("Esc để đóng · Tab để chọn · Enter để mở", "Esc to close · Tab to select · Enter to open")}</footer>
      </div>
    </dialog>
  </>;
}
