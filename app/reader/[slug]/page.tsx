"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bookmark, ChevronLeft, ChevronRight, Download, Highlighter, List, Maximize,
  Menu, MessageSquareText, MonitorPlay, Moon, PanelLeftClose, Printer, Search, Sun, X, ZoomIn, ZoomOut, Brain, ListChecks, Layers3, Sparkles, Accessibility, FilePenLine
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import type { H2OElement } from "@/types/editor";
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
  const book = books.find((item) => item.id === params.slug || item.slug === params.slug) ?? books[0];
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
  const [dark, setDark] = useState(true);
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
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as { page?: number; bookmarks?: number[]; notes?: Record<number,string> };
      if (typeof saved.page === "number" && saved.page < book.pages.length) setIndex(saved.page);
      setBookmarks(saved.bookmarks ?? []);
      setNote(saved.notes?.[saved.page ?? 0] ?? "");
    } catch { /* ignore invalid local state */ }
  }, [book, storageKey]);

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
    let saved: { page?: number; bookmarks?: number[]; notes?: Record<number,string> } = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}"); } catch { saved = {}; }
    localStorage.setItem(storageKey, JSON.stringify({ ...saved, page: nextIndex, bookmarks: nextBookmarks, notes: { ...(saved.notes ?? {}), [index]: nextNote } }));
  };
  const go = (next: number) => {
    if (!book) return;
    const safe = Math.min(book.pages.length - 1, Math.max(0, next));
    persist(safe);
    setIndex(safe);
    try { const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}"); setNote(saved.notes?.[safe] ?? ""); } catch { setNote(""); }
  };
  const toggleBookmark = () => {
    const next = bookmarks.includes(index) ? bookmarks.filter((item) => item !== index) : [...bookmarks, index];
    setBookmarks(next); persist(index, next); if (!bookmarks.includes(index)) track("bookmark_created", { resourceType: "book", resourceId: book.id, properties: { bookId: book.id, pageId: page.id, pageNumber: index + 1 } });
  };
  const saveNote = (value: string) => { setNote(value); persist(index, bookmarks, value); if (value.trim().length === 1) track("note_created", { resourceType: "book", resourceId: book.id, properties: { bookId: book.id, pageId: page.id, pageNumber: index + 1 } }); };
  const fullscreen = () => stageRef.current?.requestFullscreen?.();
  const pageGroups = useMemo(() => { const all = book?.pages.map((item, pageIndex) => ({ item, pageIndex })) ?? []; const value = search.trim().toLowerCase(); if (!value) return all; return all.filter(({ item }) => `${item.name} ${item.chapter ?? ""} ${item.elements.map((element) => element.text ?? "").join(" ")}`.toLowerCase().includes(value)); }, [book, search]);
  const downloadProject = () => { const campaign=readCampaign(book.id); if(campaign.enabled && campaign.downloadRequiresLead && !hasReaderLead(book.id)){ go(Math.max(0,(campaign.leadGatePage ?? 1)-1)); return; } const payload = JSON.stringify({ format: "h2obook-reader-export", version: 4, exportedAt: new Date().toISOString(), book }, null, 2); const url = URL.createObjectURL(new Blob([payload], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${book.slug || book.id}.h2obook.json`; anchor.click(); URL.revokeObjectURL(url); };

  if (!book || !page) return <main className="reader-not-found"><h1>Không tìm thấy sách</h1><Link href="/library">Quay lại thư viện</Link></main>;
  return <main className={`reader-shell-v2 ${dark ? "reader-dark" : "reader-light"} ${presenter ? "presenter-mode" : ""} ${highlightMode ? "reader-highlight-mode" : ""}`}>
    <header className="reader-bar-v2"><div className="reader-bar-left"><Link href="/library" className="reader-btn"><ArrowLeft size={15}/></Link><button className="reader-btn" onClick={() => setTocOpen(!tocOpen)}><Menu size={15}/></button><div><strong>{book.title}</strong><span>{page.name}</span></div></div><div className="reader-bar-center"><button className={`reader-btn ${searchOpen ? "active" : ""}`} onClick={() => { setSearchOpen(!searchOpen); setTocOpen(true); }}><Search size={15}/></button><button className={`reader-btn ${bookmarks.includes(index) ? "active" : ""}`} onClick={toggleBookmark}><Bookmark size={15} fill={bookmarks.includes(index) ? "currentColor" : "none"}/></button><button className={`reader-btn ${notesOpen ? "active" : ""}`} onClick={() => setNotesOpen(!notesOpen)}><MessageSquareText size={15}/></button><button className={`reader-btn ${highlightMode ? "active" : ""}`} title="Làm nổi bật vùng văn bản" onClick={() => setHighlightMode(!highlightMode)}><Highlighter size={15}/></button><button className={`reader-btn ${studyOpen ? "active" : ""}`} title="Smart Study local" onClick={() => setStudyOpen(!studyOpen)}><Brain size={15}/><span>Học</span></button></div><div className="reader-bar-right"><button className="reader-btn" onClick={() => setDark(!dark)}>{dark ? <Sun size={15}/> : <Moon size={15}/>}</button><button className={`reader-btn ${presenter ? "active" : ""}`} onClick={() => setPresenter(!presenter)}><MonitorPlay size={15}/><span>Trình chiếu</span></button><button className="reader-btn" onClick={() => window.print()}><Printer size={15}/></button><button className="reader-btn" onClick={fullscreen}><Maximize size={15}/></button></div></header>
    <div className="reader-main-v2" data-narrow={narrow || undefined}>
      {tocOpen && <aside className="reader-toc"><header><div><List size={16}/><strong>Mục lục</strong></div><button onClick={() => setTocOpen(false)}><PanelLeftClose size={15}/></button></header>{searchOpen && <div className="reader-search-box"><Search size={14}/><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm trong sách..."/>{search && <button onClick={() => setSearch("")}><X size={12}/></button>}</div>}<div>{pageGroups.map(({ item, pageIndex }) => <button key={item.id} className={pageIndex === index ? "active" : ""} onClick={() => go(pageIndex)}><span>{pageIndex + 1}</span><span><strong>{item.name}</strong><small>{item.chapter ?? item.pageType ?? "Trang sách"}</small></span>{bookmarks.includes(pageIndex) && <Bookmark size={11} fill="currentColor"/>}</button>)}</div></aside>}
      <section className="reader-stage-v2" ref={stageRef}><div className="reader-page-frame" style={{ width: 794 * scale, height: 1123 * scale }}><div className="reader-page-v2" style={{ width: 794, height: 1123, background: page.background, transform: `scale(${scale})` }}>{page.elements.map((element) => <ReaderElement key={element.id} element={element}/>) }<div className="watermark-v2"><span>HỌC VIÊN • {book.author} • H2OBOOK</span><span>HỌC VIÊN • {book.author} • H2OBOOK</span><span>HỌC VIÊN • {book.author} • H2OBOOK</span></div></div></div><GrowthLayer bookId={book.id} pageIndex={index}/>{presenter && page.notes && <div className="presenter-notes"><strong>Ghi chú giảng viên</strong><p>{page.notes}</p></div>}</section>
      {accessibilityOpen && <AccessibilityDock text={pageText || page.notes || page.name} onClose={() => setAccessibilityOpen(false)}/>}
      {notesOpen && <aside className="reader-notes"><header><div><MessageSquareText size={16}/><strong>Ghi chú của tôi</strong></div><button onClick={() => setNotesOpen(false)}><X size={15}/></button></header><textarea value={note} onChange={(event) => saveNote(event.target.value)} placeholder="Ghi lại ý quan trọng, câu hỏi hoặc nội dung cần thực hành..."/><small>Ghi chú được lưu trên thiết bị hiện tại.</small><div className="reader-page-note"><strong>Ghi chú giảng viên</strong><p>{page.notes || "Trang này chưa có ghi chú dành cho giảng viên."}</p></div></aside>}{studyOpen && <aside className="reader-study-dock"><header><div><Brain size={16}/><strong>Smart Study Local</strong></div><button onClick={() => setStudyOpen(false)}><X size={15}/></button></header><div className="study-dock-tabs"><button className={studyTab === "summary" ? "active" : ""} onClick={() => setStudyTab("summary")}><Layers3 size={13}/>Tóm tắt</button><button className={studyTab === "questions" ? "active" : ""} onClick={() => setStudyTab("questions")}><ListChecks size={13}/>Câu hỏi</button><button className={studyTab === "cards" ? "active" : ""} onClick={() => setStudyTab("cards")}><Sparkles size={13}/>Flashcard</button></div>{studyTab === "summary" && <div className="study-dock-content"><pre>{localStudy.summary}</pre></div>}{studyTab === "questions" && <div className="study-dock-content"><pre>{localStudy.questions}</pre></div>}{studyTab === "cards" && <div className="study-card-list">{localStudy.cards.map((card, cardIndex) => <article key={cardIndex}><strong>{card.front}</strong><p>{card.back}</p></article>)}<button className="btn btn-primary btn-sm" onClick={() => { store.addFlashcardsFromText({ text: pageText || page.notes || page.name, bookId: book.id, pageId: page.id }); store.addStudySession({ bookId: book.id, mode: "review", durationMinutes: 5, completedItems: localStudy.cards.length }); }}>Lưu thẻ vào lịch ôn</button></div>}<footer><WifiOffBadge/></footer></aside>}
    </div>
    <footer className="reader-footer-v2"><div className="reader-controls"><button className="reader-btn" onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft size={16}/></button><span>{index + 1} / {book.pages.length}</span><button className="reader-btn" onClick={() => go(index + 1)} disabled={index === book.pages.length - 1}><ChevronRight size={16}/></button></div><div className="reader-progress-v2"><span style={{ width: `${progress}%` }}/></div><div className="reader-controls"><button className="reader-btn" onClick={() => setScale((value) => Math.max(0.28, value - 0.08))}><ZoomOut size={15}/></button><span>{Math.round(scale * 100)}%</span><button className="reader-btn" onClick={() => setScale((value) => Math.min(1.25, value + 0.08))}><ZoomIn size={15}/></button><button className="reader-btn" title="Tải gói sách H2OBOOK" onClick={downloadProject}><Download size={15}/></button></div></footer>
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
  return source ? <img alt={element.altText ?? element.name} src={source} style={{ ...style, objectFit: element.imageFit ?? "cover", borderRadius: element.cornerRadius }}/> : <div aria-label={element.altText ?? element.name} style={{ ...style, background: "#eef1f4", borderRadius: element.cornerRadius }}/>;
}

function QrPreview({ element, style }: { element: H2OElement; style: React.CSSProperties }) {
  const [source,setSource]=useState<string|null>(null);
  useEffect(()=>{let cancelled=false;void import("qrcode").then((module)=>module.toDataURL(element.qrValue??"https://h2obook.vn",{errorCorrectionLevel:"H",margin:1,width:512,color:{dark:element.fill??"#222222",light:"#ffffff"}})).then((url)=>{if(!cancelled)setSource(url)}).catch(()=>setSource(null));return()=>{cancelled=true};},[element.qrValue,element.fill]);
  return source?<img alt={`QR: ${element.qrValue??""}`} src={source} style={{...style,borderRadius:element.cornerRadius}}/>:<div className="reader-qr" style={{...style,background:"white",borderRadius:element.cornerRadius}}/>;
}
