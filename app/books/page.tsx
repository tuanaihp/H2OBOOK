"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppStore } from "@/store/app-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Archive, BookOpen, Copy, FileStack, Filter, Pencil, Plus, Search, Send, Sparkles } from "lucide-react";

export default function BooksPage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const filtered = useMemo(() => store.books.filter((book) => !book.archivedAt && (status === "all" || book.status === status) && `${book.title} ${book.subtitle} ${book.category}`.toLowerCase().includes(query.toLowerCase())), [store.books, query, status]);
  const create = () => { const book = store.createBook({ title: title.trim() || "Sách mới chưa đặt tên", subtitle: subtitle.trim() || "Bắt đầu xây dựng nội dung của bạn" }); setCreateOpen(false); setTitle(""); setSubtitle(""); window.location.href = `/editor/${book.id}`; };
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">CONTENT WORKSPACE</span><h1>Dự án sách</h1><p>Tạo, chỉnh sửa, xuất bản và quản lý toàn bộ vòng đời nội dung.</p></div><div className="header-actions"><Link href="/templates" className="btn btn-secondary"><Sparkles size={16}/>Tạo từ template</Link><Link href="/input" className="btn btn-secondary" title="Nhập Word, PDF, nhiều ảnh, ZIP trang sách hoặc HTML"><FileStack size={16}/>Tạo từ ảnh / ZIP / PDF / Word</Link><button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={17}/>Sách mới</button></div></div>
    <section className="section-card"><div className="table-toolbar"><div className="search-box compact"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên sách, danh mục..."/></div><div className="toolbar-filter"><Filter size={15}/><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option><option value="template">Template</option></select></div><span className="result-count">{filtered.length} dự án</span></div>
      {filtered.length ? <div className="book-project-list">{filtered.map((book) => <article className="book-project-row" key={book.id}><div className="book-project-cover" style={{ background: book.cover }}><BookOpen size={22}/></div><div className="book-project-main"><div className="project-title-line"><strong>{book.title}</strong><Badge tone={book.status === "published" ? "success" : book.status === "template" ? "purple" : "warning"}>{book.status === "published" ? "Đã xuất bản" : book.status === "template" ? "Template" : "Bản nháp"}</Badge></div><p>{book.subtitle}</p><div className="project-meta"><span>{book.pages.length} trang</span><span>v{book.version}</span><span>{book.studentCount} học viên</span><span>{book.cloneCount} bản clone</span><span>Cập nhật {formatDate(book.updatedAt)}</span></div></div><div className="project-commerce"><strong>{book.price ? formatCurrency(book.price) : "Miễn phí"}</strong><span>{book.visibility === "public" ? "Công khai" : book.visibility === "workspace" ? "Workspace" : "Riêng tư"}</span></div><div className="row-actions"><Link className="icon-btn" href={`/reader/${book.id}`} title="Đọc"><BookOpen size={15}/></Link><Link className="icon-btn" href={`/editor/${book.id}`} title="Chỉnh sửa"><Pencil size={15}/></Link><button className="icon-btn" title="Nhân bản" onClick={() => store.duplicateBook(book.id)}><Copy size={15}/></button>{book.status !== "published" && <button className="icon-btn" title="Xuất bản" onClick={() => store.publishBook(book.id)}><Send size={15}/></button>}<button className="icon-btn" title="Lưu trữ" onClick={() => store.archiveBook(book.id)}><Archive size={15}/></button></div></article>)}</div> : <EmptyState icon={BookOpen} title="Chưa có dự án phù hợp" description="Thay đổi bộ lọc hoặc tạo một cuốn sách mới." action={<button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15}/>Tạo sách</button>}/>} 
    </section>
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo dự án sách mới" description="Bạn có thể bắt đầu từ trang trắng hoặc áp dụng template sau trong Studio."><div className="form-grid"><label className="field full"><span>Tên sách</span><input className="input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Giáo trình Makeup Cô Dâu"/></label><label className="field full"><span>Mô tả ngắn</span><textarea className="textarea" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="Mục tiêu và nội dung chính của cuốn sách..."/></label></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={create}><Plus size={15}/>Tạo và mở Studio</button></div></Modal>
  </AppShell>;
}
