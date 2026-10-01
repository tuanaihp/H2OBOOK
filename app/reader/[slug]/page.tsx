"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bookmark, BookOpen, ChevronLeft, ChevronRight, Coffee, Download, EyeOff, Highlighter, List, Maximize,
  Menu, MessageSquareText, MonitorPlay, Moon, PanelLeftClose, Printer, Scroll, Search, Square, Sun, Timer, Volume2, X, ZoomIn, ZoomOut, Brain, ListChecks, Layers3, Sparkles, Accessibility, FilePenLine
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import type { H2OElement, H2OBook } from "@/types/editor";
import { localFlashcards, localQuiz, localSummary } from "@/lib/local-smart-engine";
import { resolveAssetUrl } from "@/lib/assets/asset-client";
import { resolveElement } from "@/lib/brand-resolver";
import { GrowthLayer } from "@/components/reader/growth-layer";
import { AccessibilityDock } from "@/components/reader/accessibility-dock";
import { hasReaderLead, readCampaign } from "@/lib/growth/local-campaign";
import { track } from "@/lib/analytics/client";

export default function ReaderPage() {
  const params = useParams<{ slug: string }>();
  const store = useAppStore();
  const books = store.books;
  // Never fall back to books[0]: an unknown slug used to silently render the first book in the
  // library under the wrong URL. Try the org's cloud copy first, then report "not found".
  const localBook = books.find((item) => item.id === params.slug || item.slug === params.slug);
  const [remoteBook, setRemoteBook] = useState<H2OBook | null>(null);
  const [remoteState, setRemoteState] = useState<"idle" | "loading" | "missing">("idle");
  const book = localBook ?? remoteBook;
  const [index, setIndex] = useState(0);
  // 0.68 of an A4 width is 540px of page plus the table of contents, which overflows any phone.
  // The starting scale and the sidebar now follow the viewport; both stay fully adjustable
  // afterwards, so this only changes where the reader opens, never what it can do.
  const [scale, setScale] = useState(0.68);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [tocOpen, setTocOpen] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [presenter, setPresenter] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light" | "sepia">("dark");
  const [viewMode, setViewMode] = useState<"page" | "scroll">("page");
  const [zen, setZen] = useState(false);
  const [turnDir, setTurnDir] = useState<1 | -1>(1);
  const [autoFlip, setAutoFlip] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const scrollStageRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [note, setNote] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightMode, setHighlightMode] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [studyTab, setStudyTab] = useState<"summary" | "questions" | "cards">("summary");
  const stageRef = useRef<HTMLDivElement>(null);
  const pageStartedAt = useRef(Date.now());
  const openedBook = useRef<string | null>(null);
  // Server sync only applies to books whose id is a real database UUID — local seed ids like
  // "book_makeup_pro" would fail the uuid column. Timers debounce writes so typing a note or
  // flipping pages quickly doesn't fire a request per keystroke.
  const progressSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverBookId = book && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(book.id) ? book.id : null;
  // Books authored from a template carry {{brand.name}}, {{expert.title}} and friends. The editor
  // resolves them against the active brand; the reader never did, so a published book showed the
  // raw handlebars to the reader. Resolving here fixes it for every book at once rather than by
  // rewriting seed content, and leaves the stored document untouched.
  const activeBrand = store.brands.find((candidate) => candidate.id === store.activeBrandId) ?? store.brands[0];
  const rawPage = book?.pages[index] ?? book?.pages[0];
  const page = useMemo(
    () => (rawPage && activeBrand ? { ...rawPage, elements: rawPage.elements.map((element) => resolveElement(element, activeBrand)) } : rawPage),
    [rawPage, activeBrand]
  );
  const progress = ((index + 1) / Math.max(1, book?.pages.length ?? 1)) * 100;
  const storageKey = `h2obook-reader-${book?.id}`;
  const pageText = page?.elements.filter((element) => element.type === "text").map((element) => element.text ?? "").join("\n") ?? "";
  const localStudy = { summary: localSummary(pageText || page?.notes || page?.name || "Trang chưa có nội dung văn bản."), questions: localQuiz(pageText || page?.notes || page?.name || "Trang chưa có nội dung văn bản."), cards: localFlashcards(pageText || page?.notes || page?.name || "Trang chưa có nội dung văn bản.") };

  // When the slug isn't in the local library, try the organization's cloud copy so a published
  // book still opens on another device or after a fresh browser. Guests/demo stay local-only.
  useEffect(() => {
    if (localBook || remoteBook || remoteState !== "idle") return;
    if (process.env.NEXT_PUBLIC_APP_MODE !== "production") { setRemoteState("missing"); return; }
    setRemoteState("loading");
    const organizationId = store.workspace.id;
    void fetch(`/api/books/cloud-load?clientKey=${encodeURIComponent(params.slug)}&organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { book?: H2OBook | null } | null) => {
        if (payload?.book?.pages?.length) setRemoteBook(payload.book);
        else setRemoteState("missing");
      })
      .catch(() => setRemoteState("missing"));
  }, [localBook, remoteBook, remoteState, params.slug, store.workspace.id]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const apply = (matches: boolean) => {
      setNarrow(matches);
      if (!matches) return;
      setTocOpen(false);
      // 32px covers the stage padding either side; clamped so the page never renders unreadably
      // small on a very narrow device.
      setScale((current) => Math.min(current, Math.max(0.3, (window.innerWidth - 32) / 794)));
    };
    apply(query.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (!book) return;
    let saved: { page?: number; bookmarks?: number[]; notes?: Record<number,string>; at?: number } = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      if (typeof saved.page === "number" && saved.page < book.pages.length) setIndex(saved.page);
      setBookmarks(saved.bookmarks ?? []);
      setNote(saved.notes?.[saved.page ?? 0] ?? "");
    } catch { /* ignore invalid local state */ }
    if (!serverBookId) return;
    const localAt = typeof saved.at === "number" ? saved.at : 0;
    // Server is the cross-device source: a newer last_read_at wins over this device's saved page.
    void fetch(`/api/student/reader/progress?resourceType=book&resourceId=${serverBookId}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { progress?: { progressPercent: number; lastReadAt: string | null } | null } | null) => {
        const progress = payload?.progress;
        if (!progress) return;
        const serverAt = progress.lastReadAt ? Date.parse(progress.lastReadAt) : 0;
        if (progress.progressPercent > 0 && serverAt > localAt) {
          const serverPage = Math.min(book.pages.length - 1, Math.max(0, Math.round((progress.progressPercent / 100) * book.pages.length) - 1));
          setIndex(serverPage);
        }
      })
      .catch(() => {});
    // Server notes use the "Trang N" title convention — merge them in only for pages without a
    // local note so an in-progress draft on this device is never overwritten.
    void fetch(`/api/student/reader/note?resourceType=book&resourceId=${serverBookId}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { notes?: Array<{ title?: string; body?: string }> } | null) => {
        const merged: Record<number, string> = { ...(saved.notes ?? {}) };
        let changed = false;
        for (const item of payload?.notes ?? []) {
          const match = /^Trang (\d+)$/.exec(String(item.title ?? ""));
          if (!match) continue;
          const pageIndex = Number(match[1]) - 1;
          if (pageIndex >= 0 && pageIndex < book.pages.length && merged[pageIndex] === undefined && String(item.body ?? "").trim()) {
            merged[pageIndex] = String(item.body);
            changed = true;
          }
        }
        if (!changed) return;
        try { localStorage.setItem(storageKey, JSON.stringify({ ...saved, notes: merged, at: saved.at ?? Date.now() })); } catch { /* storage full */ }
        setNote((current) => current || merged[saved.page ?? 0] || "");
      })
      .catch(() => {});
  }, [book, storageKey, serverBookId]);

  useEffect(() => {
    if (!book || openedBook.current === book.id) return;
    openedBook.current = book.id;
    track("book_opened", { resourceType: "book", resourceId: book.id, properties: { bookId: book.id, pageCount: book.pages.length } });
  }, [book]);

  useEffect(() => {
    if (!book || !page) return;
    pageStartedAt.current = Date.now();
    track("page_viewed", { resourceType: "book", resourceId: book.id, properties: { bookId: book.id, pageId: page.id, pageNumber: index + 1 } });
    return () => {
      track("page_completed", { resourceType: "book", resourceId: book.id, properties: { bookId: book.id, pageId: page.id, pageNumber: index + 1, durationMs: Date.now() - pageStartedAt.current } });
    };
  }, [book, page, index]);

  const persist = (nextIndex: number, nextBookmarks = bookmarks, nextNote = note) => {
    if (!book) return;
    let saved: { page?: number; bookmarks?: number[]; notes?: Record<number,string>; at?: number } = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}"); } catch { saved = {}; }
    localStorage.setItem(storageKey, JSON.stringify({ ...saved, page: nextIndex, bookmarks: nextBookmarks, notes: { ...(saved.notes ?? {}), [index]: nextNote }, at: Date.now() }));
    if (!serverBookId) return;
    if (progressSyncTimer.current) clearTimeout(progressSyncTimer.current);
    const percent = Math.round(((nextIndex + 1) / Math.max(1, book.pages.length)) * 100);
    const bookmarked = nextBookmarks.length > 0;
    progressSyncTimer.current = setTimeout(() => {
      void fetch("/api/student/reader/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceType: "book", resourceId: serverBookId, progressPercent: percent, bookmarked })
      }).catch(() => {});
    }, 800);
  };
  const go = (next: number) => {
    if (!book) return;
    const safe = Math.min(book.pages.length - 1, Math.max(0, next));
    setTurnDir(safe >= index ? 1 : -1);
    persist(safe);
    setIndex(safe);
    if (viewMode === "scroll") window.setTimeout(() => document.getElementById(`reader-page-${safe}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    try { const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}"); setNote(saved.notes?.[safe] ?? ""); } catch { setNote(""); }
  };
  const toggleBookmark = () => {
    const next = bookmarks.includes(index) ? bookmarks.filter((item) => item !== index) : [...bookmarks, index];
    setBookmarks(next); persist(index, next); if (!bookmarks.includes(index) && book && page) track("bookmark_created", { resourceType: "book", resourceId: book.id, properties: { bookId: book.id, pageId: page.id, pageNumber: index + 1 } });
  };
  const saveNote = (value: string) => {
    setNote(value); persist(index, bookmarks, value);
    if (value.trim().length === 1 && book && page) track("note_created", { resourceType: "book", resourceId: book.id, properties: { bookId: book.id, pageId: page.id, pageNumber: index + 1 } });
    if (!serverBookId) return;
    if (noteSyncTimer.current) clearTimeout(noteSyncTimer.current);
    const pageIndex = index;
    noteSyncTimer.current = setTimeout(() => {
      if (!value.trim()) return;
      void fetch("/api/student/reader/note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceType: "book", resourceId: serverBookId, title: `Trang ${pageIndex + 1}`, body: value })
      }).catch(() => {});
    }, 1500);
  };
  const fullscreen = () => stageRef.current?.requestFullscreen?.();
  const cycleTheme = () => setTheme(theme === "dark" ? "sepia" : theme === "sepia" ? "light" : "dark");
  const speakable = Boolean(pageText.trim() || page?.notes || page?.name);

  // Keyboard navigation — standard ebook keys. Inputs/textareas are left alone so typing
  // a note or search never flips a page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (event.key === "Escape") { setZen(false); return; }
      if (viewMode !== "page") return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") { event.preventDefault(); go(index + 1); }
      else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); go(index - 1); }
      else if (event.key === "Home") go(0);
      else if (event.key === "End") go((book?.pages.length ?? 1) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, book, viewMode]);

  // Auto-flip: a self-resetting timeout per page; stops at the last page.
  useEffect(() => {
    if (!autoFlip || viewMode !== "page" || !book) return;
    const timer = window.setTimeout(() => { if (index >= book.pages.length - 1) setAutoFlip(0); else go(index + 1); }, autoFlip * 1000);
    return () => window.clearTimeout(timer);
  }, [autoFlip, index, viewMode, book]);

  // Scroll mode: the visible page wins the index so TOC/progress stay truthful while
  // the reader just scrolls through the whole book.
  useEffect(() => {
    if (viewMode !== "scroll" || !book) return;
    const container = scrollStageRef.current;
    if (!container) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const next = Number((entry.target as HTMLElement).dataset.pageIndex);
        if (Number.isNaN(next)) continue;
        setIndex((previous) => { if (previous !== next) persist(next); return next; });
      }
    }, { root: container, threshold: 0.5 });
    container.querySelectorAll("[data-page-index]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [viewMode, book, scale]);

  // Text-to-speech: stop when the page changes or the reader unmounts.
  const toggleSpeak = () => {
    if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false); return; }
    const text = pageText || page?.notes || page?.name || "";
    if (!text.trim() || typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN"; utterance.rate = 1;
    utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); setSpeaking(true);
  };
  useEffect(() => { window.speechSynthesis?.cancel(); setSpeaking(false); }, [index]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // Rough minutes left: ~180 wpm on text pages, ~24s on image-only pages.
  const remainingMinutes = useMemo(() => {
    if (!book) return 0;
    let words = 0, imagePages = 0;
    for (const item of book.pages.slice(index)) {
      const text = item.elements.filter((element) => element.type === "text").map((element) => element.text ?? "").join(" ").trim();
      if (text) words += text.split(/\s+/).length; else imagePages += 1;
    }
    return Math.max(0, Math.round(words / 180 + imagePages * 0.4));
  }, [book, index]);
  const pageGroups = useMemo(() => { const all = book?.pages.map((item, pageIndex) => ({ item, pageIndex })) ?? []; const value = search.trim().toLowerCase(); if (!value) return all; return all.filter(({ item }) => `${item.name} ${item.chapter ?? ""} ${item.elements.map((element) => element.text ?? "").join(" ")}`.toLowerCase().includes(value)); }, [book, search]);
  const downloadProject = () => { if (!book) return; const campaign=readCampaign(book.id); if(campaign.enabled && campaign.downloadRequiresLead && !hasReaderLead(book.id)){ go(Math.max(0,(campaign.leadGatePage ?? 1)-1)); return; } const payload = JSON.stringify({ format: "h2obook-reader-export", version: 4, exportedAt: new Date().toISOString(), book }, null, 2); const url = URL.createObjectURL(new Blob([payload], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${"slug" in book && book.slug ? book.slug : book.id}.h2obook.json`; anchor.click(); URL.revokeObjectURL(url); };

  if (!book || !page) {
    const stillLoading = !localBook && remoteState !== "missing";
    return <main className="reader-not-found">{stillLoading ? <h1>Đang mở sách…</h1> : <><h1>Không tìm thấy sách</h1><Link href="/library">Quay lại thư viện</Link></>}</main>;
  }
  return <main className={`reader-shell-v2 ${theme === "dark" ? "reader-dark" : theme === "sepia" ? "reader-sepia" : "reader-light"} ${presenter ? "presenter-mode" : ""} ${highlightMode ? "reader-highlight-mode" : ""} ${zen ? "reader-zen" : ""} ${viewMode === "scroll" ? "reader-scroll-mode" : ""}`}>
    <header className="reader-bar-v2"><div className="reader-bar-left"><Link href="/library" className="reader-btn" aria-label="Quay lại thư viện"><ArrowLeft size={15} aria-hidden="true"/></Link><button className="reader-btn" aria-label="Mục lục" aria-expanded={tocOpen} onClick={() => setTocOpen(!tocOpen)}><Menu size={15} aria-hidden="true"/></button><div><strong>{book.title}</strong><span>{page.name}</span></div></div><div className="reader-bar-center"><button className={`reader-btn ${searchOpen ? "active" : ""}`} aria-label="Tìm trong sách" aria-pressed={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setTocOpen(true); }}><Search size={15} aria-hidden="true"/></button><button className={`reader-btn ${bookmarks.includes(index) ? "active" : ""}`} aria-label="Đánh dấu trang" aria-pressed={bookmarks.includes(index)} onClick={toggleBookmark}><Bookmark size={15} aria-hidden="true" fill={bookmarks.includes(index) ? "currentColor" : "none"}/></button><button className={`reader-btn ${notesOpen ? "active" : ""}`} aria-label="Ghi chú" aria-pressed={notesOpen} onClick={() => setNotesOpen(!notesOpen)}><MessageSquareText size={15} aria-hidden="true"/></button><button className={`reader-btn ${highlightMode ? "active" : ""}`} title="Làm nổi bật vùng văn bản" aria-label="Làm nổi bật vùng văn bản" aria-pressed={highlightMode} onClick={() => setHighlightMode(!highlightMode)}><Highlighter size={15} aria-hidden="true"/></button><button className={`reader-btn ${studyOpen ? "active" : ""}`} title="Smart Study local" aria-label="Smart Study" aria-pressed={studyOpen} onClick={() => setStudyOpen(!studyOpen)}><Brain size={15} aria-hidden="true"/><span>Học</span></button><button className={`reader-btn ${viewMode === "scroll" ? "active" : ""}`} title="Đổi cách đọc: lật trang ↔ cuộn dọc" aria-label="Đổi chế độ đọc" aria-pressed={viewMode === "scroll"} onClick={() => setViewMode(viewMode === "page" ? "scroll" : "page")}>{viewMode === "scroll" ? <BookOpen size={15} aria-hidden="true"/> : <Scroll size={15} aria-hidden="true"/>}<span>{viewMode === "scroll" ? "Lật trang" : "Cuộn dọc"}</span></button><button className={`reader-btn ${autoFlip ? "active" : ""}`} title="Tự lật trang" aria-label="Tự lật trang" aria-pressed={Boolean(autoFlip)} onClick={() => setAutoFlip(autoFlip === 0 ? 8 : autoFlip === 8 ? 15 : autoFlip === 15 ? 30 : 0)}><Timer size={15} aria-hidden="true"/><span>{autoFlip ? `${autoFlip}s` : "Tự lật"}</span></button></div><div className="reader-bar-right"><button className={`reader-btn ${speaking ? "active" : ""}`} disabled={!speakable} title={speaking ? "Dừng đọc to" : "Đọc to trang này"} aria-label="Đọc to trang này" aria-pressed={speaking} onClick={toggleSpeak}>{speaking ? <Square size={14} aria-hidden="true"/> : <Volume2 size={15} aria-hidden="true"/>}</button><button className="reader-btn" aria-label="Đổi màu nền đọc" title={theme === "dark" ? "Nền tối → nền sepia" : theme === "sepia" ? "Nền sepia → nền sáng" : "Nền sáng → nền tối"} onClick={cycleTheme}>{theme === "dark" ? <Moon size={15} aria-hidden="true"/> : theme === "sepia" ? <Coffee size={15} aria-hidden="true"/> : <Sun size={15} aria-hidden="true"/>}</button><button className={`reader-btn hide-mobile ${presenter ? "active" : ""}`} aria-label="Chế độ trình chiếu" aria-pressed={presenter} onClick={() => setPresenter(!presenter)}><MonitorPlay size={15} aria-hidden="true"/><span>Trình chiếu</span></button><button className="reader-btn hide-mobile" aria-label="In sách" onClick={() => window.print()}><Printer size={15} aria-hidden="true"/></button><button className="reader-btn hide-mobile" aria-label="Toàn màn hình" onClick={fullscreen}><Maximize size={15} aria-hidden="true"/></button><button className="reader-btn" aria-label="Chế độ tập trung" title="Tập trung — ẩn thanh công cụ (chạm giữa trang để hiện lại)" onClick={() => setZen(true)}><EyeOff size={15} aria-hidden="true"/></button></div></header>
    <div className="reader-main-v2" data-narrow={narrow || undefined}>
      {tocOpen && <aside className="reader-toc"><header><div><List size={16}/><strong>Mục lục</strong></div><button aria-label="Đóng mục lục" onClick={() => setTocOpen(false)}><PanelLeftClose size={15} aria-hidden="true"/></button></header>{searchOpen && <div className="reader-search-box"><Search size={14}/><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm trong sách..."/>{search && <button aria-label="Xóa từ khóa tìm kiếm" onClick={() => setSearch("")}><X size={12} aria-hidden="true"/></button>}</div>}<div>{pageGroups.map(({ item, pageIndex }) => <button key={item.id} className={pageIndex === index ? "active" : ""} onClick={() => go(pageIndex)}><span>{pageIndex + 1}</span><span><strong>{item.name}</strong><small>{item.chapter ?? item.pageType ?? "Trang sách"}</small></span>{bookmarks.includes(pageIndex) && <Bookmark size={11} fill="currentColor"/>}</button>)}</div></aside>}
      <section
        className="reader-stage-v2"
        ref={stageRef}
        onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY }; }}
        onTouchEnd={(event) => {
          if (viewMode !== "page") return;
          const start = touchStart.current; touchStart.current = null;
          if (!start) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1));
        }}
        // Ebook-style tap zones: outer 18% flips the page, the center toggles zen mode.
        // Interactive children (buttons, growth overlays, notes) are ignored via closest().
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button,a,input,textarea,select,[role='button'],.reader-growth-gate,.reader-growth-block")) return;
          const ratio = (event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.getBoundingClientRect().width;
          if (ratio < 0.18) go(index - 1);
          else if (ratio > 0.82) go(index + 1);
          else setZen((value) => !value);
        }}
      >
        {viewMode === "scroll"
          ? <div className="reader-scroll-stack" ref={scrollStageRef}>{book.pages.map((item, pageIndex) => <div className="reader-scroll-page" data-page-index={pageIndex} id={`reader-page-${pageIndex}`} key={item.id}><div className="reader-page-frame" style={{ width: (item.width ?? 794) * scale, height: (item.height ?? 1123) * scale }}><div className="reader-page-v2" style={{ width: item.width ?? 794, height: item.height ?? 1123, background: item.background, transform: `scale(${scale})` }}>{item.elements.map((element) => <ReaderElement key={element.id} element={activeBrand ? resolveElement(element, activeBrand) : element}/>)}<div className="watermark-v2"><span>HỌC VIÊN • {book.author} • H2OBOOK</span><span>HỌC VIÊN • {book.author} • H2OBOOK</span><span>HỌC VIÊN • {book.author} • H2OBOOK</span></div></div></div></div>)}</div>
          : <div className={`reader-page-frame turn-${turnDir > 0 ? "next" : "prev"}`} key={index} style={{ width: (page.width ?? 794) * scale, height: (page.height ?? 1123) * scale }}><div className="reader-page-v2" style={{ width: page.width ?? 794, height: page.height ?? 1123, background: page.background, transform: `scale(${scale})` }}>{page.elements.map((element) => <ReaderElement key={element.id} element={element}/>) }<div className="watermark-v2"><span>HỌC VIÊN • {book.author} • H2OBOOK</span><span>HỌC VIÊN • {book.author} • H2OBOOK</span><span>HỌC VIÊN • {book.author} • H2OBOOK</span></div></div></div>}
        <GrowthLayer bookId={book.id} pageIndex={index}/>{presenter && page.notes && <div className="presenter-notes"><strong>Ghi chú giảng viên</strong><p>{page.notes}</p></div>}</section>
      {accessibilityOpen && <AccessibilityDock text={pageText || page.notes || page.name} onClose={() => setAccessibilityOpen(false)}/>}
      {notesOpen && <aside className="reader-notes"><header><div><MessageSquareText size={16}/><strong>Ghi chú của tôi</strong></div><button onClick={() => setNotesOpen(false)}><X size={15}/></button></header><textarea value={note} onChange={(event) => saveNote(event.target.value)} placeholder="Ghi lại ý quan trọng, câu hỏi hoặc nội dung cần thực hành..."/><small>{serverBookId ? "Ghi chú đồng bộ với tài khoản của bạn." : "Ghi chú được lưu trên thiết bị hiện tại."}</small><div className="reader-page-note"><strong>Ghi chú giảng viên</strong><p>{page.notes || "Trang này chưa có ghi chú dành cho giảng viên."}</p></div></aside>}{studyOpen && <aside className="reader-study-dock"><header><div><Brain size={16}/><strong>Smart Study Local</strong></div><button onClick={() => setStudyOpen(false)}><X size={15}/></button></header><div className="study-dock-tabs"><button className={studyTab === "summary" ? "active" : ""} onClick={() => setStudyTab("summary")}><Layers3 size={13}/>Tóm tắt</button><button className={studyTab === "questions" ? "active" : ""} onClick={() => setStudyTab("questions")}><ListChecks size={13}/>Câu hỏi</button><button className={studyTab === "cards" ? "active" : ""} onClick={() => setStudyTab("cards")}><Sparkles size={13}/>Flashcard</button></div>{studyTab === "summary" && <div className="study-dock-content"><pre>{localStudy.summary}</pre></div>}{studyTab === "questions" && <div className="study-dock-content"><pre>{localStudy.questions}</pre></div>}{studyTab === "cards" && <div className="study-card-list">{localStudy.cards.map((card, cardIndex) => <article key={cardIndex}><strong>{card.front}</strong><p>{card.back}</p></article>)}<button className="btn btn-primary btn-sm" onClick={() => { store.addFlashcardsFromText({ text: pageText || page.notes || page.name, bookId: book.id, pageId: page.id }); store.addStudySession({ bookId: book.id, mode: "review", durationMinutes: 5, completedItems: localStudy.cards.length }); }}>Lưu thẻ vào lịch ôn</button></div>}<footer><WifiOffBadge/></footer></aside>}
    </div>
    <footer className="reader-footer-v2"><div className="reader-controls"><button className="reader-btn" aria-label="Trang trước" onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft size={16} aria-hidden="true"/></button><span>{index + 1} / {book.pages.length}</span><button className="reader-btn" aria-label="Trang sau" onClick={() => go(index + 1)} disabled={index === book.pages.length - 1}><ChevronRight size={16} aria-hidden="true"/></button></div><div className="reader-progress-v2"><input className="reader-jump" type="range" min={1} max={book.pages.length} value={index + 1} aria-label="Nhảy nhanh tới trang" onChange={(event) => go(Number(event.target.value) - 1)}/><span style={{ width: `${progress}%` }}/>{remainingMinutes > 0 && <em>≈{remainingMinutes} phút còn lại</em>}</div><div className="reader-controls"><button className="reader-btn" aria-label="Thu nhỏ" onClick={() => setScale((value) => Math.max(0.28, value - 0.08))}><ZoomOut size={15} aria-hidden="true"/></button><span>{Math.round(scale * 100)}%</span><button className="reader-btn" aria-label="Phóng to" onClick={() => setScale((value) => Math.min(1.25, value + 0.08))}><ZoomIn size={15} aria-hidden="true"/></button><button className="reader-btn" title="Tải gói sách H2OBOOK" aria-label="Tải gói sách H2OBOOK" onClick={downloadProject}><Download size={15} aria-hidden="true"/></button></div></footer>
  </main>;
}

function WifiOffBadge() { return <span className="reader-local-badge">LOCAL · KHÔNG DÙNG AI</span>; }

function ReaderElement({ element }: { element: H2OElement }) {
  const style: React.CSSProperties = { position: "absolute", left: element.x, top: element.y, width: element.width, height: element.height, transform: `rotate(${element.rotation}deg)`, opacity: element.opacity, display: element.hidden ? "none" : "block", overflow: "hidden", boxShadow: element.shadow ? `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px color-mix(in srgb, ${element.shadow.color} ${Math.round(element.shadow.opacity * 100)}%, transparent)` : undefined };
  if (element.type === "text") return <div style={{ ...style, color: element.fill, fontSize: element.fontSize, fontFamily: element.fontFamily, fontWeight: element.fontWeight, fontStyle: element.fontStyle, textDecoration: element.textDecoration === "none" ? undefined : element.textDecoration, lineHeight: element.lineHeight ?? 1.35, letterSpacing: element.letterSpacing, textAlign: element.align, whiteSpace: "pre-wrap" }}>{element.text}</div>;
  if (element.type === "image") return <ReaderImage element={element} style={style}/>;
  if (element.type === "qr") return <QrPreview element={element} style={style}/>;
  return <div style={{ ...style, background: element.fill, border: `${element.strokeWidth ?? 0}px solid ${element.stroke ?? "transparent"}`, borderRadius: element.cornerRadius }}/>;
}

function ReaderImage({ element, style }: { element: H2OElement; style: React.CSSProperties }) {
  const [source, setSource] = useState<string | null>(element.imageUrl ?? null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (!element.assetId || element.imageUrl) { setSource(element.imageUrl ?? null); return; }
    void resolveAssetUrl(element.assetId).then((url) => { objectUrl = url; if (!cancelled) setSource(url); });
    return () => { cancelled = true; if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl); };
  }, [element.assetId, element.imageUrl]);
  return source ? <img alt={element.altText ?? element.name} src={source} loading="lazy" decoding="async" style={{ ...style, objectFit: element.imageFit ?? "cover", borderRadius: element.cornerRadius }}/> : <div aria-label={element.altText ?? element.name} style={{ ...style, background: "#eef1f4", borderRadius: element.cornerRadius }}/>;
}

function QrPreview({ element, style }: { element: H2OElement; style: React.CSSProperties }) {
  const [source,setSource]=useState<string|null>(null);
  useEffect(()=>{let cancelled=false;void import("qrcode").then((module)=>module.toDataURL(element.qrValue??"https://h2obook.vn",{errorCorrectionLevel:"H",margin:1,width:512,color:{dark:element.fill??"#222222",light:"#ffffff"}})).then((url)=>{if(!cancelled)setSource(url)}).catch(()=>setSource(null));return()=>{cancelled=true};},[element.qrValue,element.fill]);
  return source?<img alt={`QR: ${element.qrValue??""}`} src={source} style={{...style,borderRadius:element.cornerRadius}}/>:<div className="reader-qr" style={{...style,background:"white",borderRadius:element.cornerRadius}}/>;
}
