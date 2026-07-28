"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { BookOpen, FileText, Globe2, Image, Link2, Mic2, NotebookPen, Plus, Search, Video } from "lucide-react";
import { useMemo, useState } from "react";

const icons = { book: BookOpen, pdf: FileText, docx: FileText, image: Image, audio: Mic2, video: Video, url: Globe2, note: NotebookPen };

export default function KnowledgePage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const sources = useMemo(() => store.knowledgeSources.filter((source) => `${source.title} ${source.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [store.knowledgeSources, query]);
  const addSource = () => { if (!sourceTitle.trim()) return; store.addKnowledgeSource({ title: sourceTitle.trim(), sourceType: "note", tags: ["tự tạo"] }); setSourceTitle(""); };
  return <AppShell>
    <section className="quantum-hero knowledge-hero"><div><span className="eyebrow">KNOWLEDGE SPACE</span><h1>Một nơi cho toàn bộ tri thức của bạn.</h1><p>Quản lý sách, ghi chú, PDF, Word, hình ảnh và liên kết ngay cả khi không kết nối AI. Khi cần, AI có thể được bật như một lớp tìm hiểu bổ sung.</p></div><div className="knowledge-glyph"><span/><span/><span/><i/></div></section>
    <div className="knowledge-toolbar"><div className="search-box"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc thẻ..."/></div><div className="inline-create"><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addSource(); }} placeholder="Thêm ghi chú hoặc nguồn mới..."/><button className="btn btn-primary btn-sm" onClick={addSource}><Plus size={14}/>Thêm</button></div></div>
    <div className="knowledge-grid">{sources.map((source) => { const Icon = icons[source.sourceType]; return <article className="knowledge-card" key={source.id}><div className={`knowledge-icon type-${source.sourceType}`}><Icon/></div><div><span className="badge badge-neutral">{source.sourceType.toUpperCase()}</span><h3>{source.title}</h3><p>{source.tags.length ? source.tags.map((tag) => `#${tag}`).join("  ") : "Chưa có thẻ"}</p></div><footer><span className={`status-dot ${source.status}`}/>{source.status === "ready" ? "Sẵn sàng" : source.status}<button><Link2 size={14}/></button></footer></article>; })}</div>
    <section className="section-card notes-board"><div className="section-head"><div><h2>Ghi chú đã lưu</h2><p>Nội dung ngắn có thể gắn với từng cuốn sách.</p></div></div><div className="section-body note-grid">{store.learningNotes.map((note) => <article key={note.id}><strong>{note.title}</strong><p>{note.content}</p><div>{note.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></article>)}</div></section>
  </AppShell>;
}
