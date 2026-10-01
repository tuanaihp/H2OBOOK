"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppStore } from "@/store/app-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertTriangle, Archive, BookOpen, Copy, FileStack, Filter, LayoutTemplate, Pencil, Plus, Search, Send, Sparkles, Trash2 } from "lucide-react";
import type { BookRecord } from "@/types/domain";

type RemoteBook = {
  id: string; slug: string | null; title: string; subtitle: string; description: string; author: string;
  status: "draft" | "published" | "archived"; cover: string; version: number; pageCount: number; updatedAt: string;
};

export default function BooksPage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [remoteBooks, setRemoteBooks] = useState<RemoteBook[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<BookRecord | null>(null);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Merge the organization's cloud books into the list so a book saved on another device still
  // shows up here. Remote entries arrive without pages — the editor/reader lazily cloud-load them.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_MODE !== "production") return;
    let cancelled = false;
    void fetch(`/api/books/list?organizationId=${encodeURIComponent(store.workspace.id)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { books?: RemoteBook[] } | null) => { if (!cancelled && payload?.books) setRemoteBooks(payload.books); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [store.workspace.id]);

  const allBooks = useMemo(() => {
    const localIds = new Set(store.books.map((book) => book.id));
    const stubs = remoteBooks
      .filter((remote) => !localIds.has(remote.id))
      .map((remote): BookRecord => ({
        id: remote.id, title: remote.title, subtitle: remote.subtitle, author: remote.author, cover: remote.cover,
        status: remote.status === "archived" ? "draft" : remote.status, pages: [], updatedAt: remote.updatedAt,
        description: remote.description, slug: remote.slug ?? remote.id,
        visibility: remote.status === "published" ? "public" : "workspace", category: "Cloud", tags: [],
        price: 0, readingMinutes: Math.max(5, remote.pageCount * 3), version: remote.version,
        ownerId: "cloud", brandId: "", publishedAt: remote.status === "published" ? remote.updatedAt : undefined,
        archivedAt: remote.status === "archived" ? remote.updatedAt : undefined, cloneCount: 0, studentCount: 0
      }));
    return [...store.books, ...stubs];
  }, [store.books, remoteBooks]);
  const remotePageCount = useMemo(() => new Map(remoteBooks.map((remote) => [remote.id, remote.pageCount])), [remoteBooks]);

  const filtered = useMemo(() => allBooks.filter((book) => (status === "archived" ? Boolean(book.archivedAt) : !book.archivedAt && (status === "all" || book.status === status)) && `${book.title} ${book.subtitle} ${book.category}`.toLowerCase().includes(query.toLowerCase())), [allBooks, query, status]);
  const create = () => { const book = store.createBook({ title: title.trim() || "Sách mới chưa đặt tên", subtitle: subtitle.trim() || "Bắt đầu xây dựng nội dung của bạn" }); setCreateOpen(false); setTitle(""); setSubtitle(""); window.location.href = `/editor/${book.id}`; };
  const openDelete = (book: BookRecord) => { setDeleteTarget(book); setDeletePhrase(""); setDeleteError(""); };
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const result = await store.removeBook(deleteTarget.id);
    setDeleting(false);
    if (!result.ok) { setDeleteError(`Không xóa được sách (${result.error ?? "lỗi không xác định"}). Dữ liệu vẫn được giữ — thử lại sau.`); return; }
    // Drop the cloud stub too, otherwise a deleted cloud book would reappear from remoteBooks.
    setRemoteBooks((current) => current.filter((remote) => remote.id !== deleteTarget.id));
    setDeleteTarget(null);
  };
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">CONTENT WORKSPACE</span><h1>Dự án sách</h1><p>Tạo, chỉnh sửa, xuất bản và quản lý toàn bộ vòng đời nội dung.</p></div><div className="header-actions"><Link href="/templates" className="btn btn-secondary"><Sparkles size={16}/>Tạo từ template</Link><Link href="/input" className="btn btn-secondary" title="Nhập Word, PDF, nhiều ảnh, ZIP trang sách hoặc HTML"><FileStack size={16}/>Tạo từ ảnh / ZIP / PDF / Word</Link><button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={17}/>Sách mới</button></div></div>
    <section className="section-card"><div className="table-toolbar"><div className="search-box compact"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên sách, danh mục..."/></div><div className="toolbar-filter"><Filter size={15}/><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option><option value="template">Template</option><option value="archived">Đã lưu trữ</option></select></div><span className="result-count">{filtered.length} dự án</span></div>
      {filtered.length ? <div className="book-project-list">{filtered.map((book) => <article className="book-project-row" key={book.id}><div className="book-project-cover" style={{ background: book.cover }}><BookOpen size={22}/></div><div className="book-project-main"><div className="project-title-line"><strong>{book.title}</strong><Badge tone={book.archivedAt ? "neutral" : book.status === "published" ? "success" : book.status === "template" ? "purple" : "warning"}>{book.archivedAt ? "Đã lưu trữ" : book.status === "published" ? "Đã xuất bản" : book.status === "template" ? "Template" : "Bản nháp"}</Badge></div><p>{book.subtitle}</p><div className="project-meta"><span>{book.pages.length || remotePageCount.get(book.id) || 0} trang</span><span>v{book.version}</span><span>{book.studentCount} học viên</span><span>{book.cloneCount} bản clone</span><span>Cập nhật {formatDate(book.updatedAt)}</span></div></div><div className="project-commerce"><strong>{book.price ? formatCurrency(book.price) : "Miễn phí"}</strong><span>{book.visibility === "public" ? "Công khai" : book.visibility === "workspace" ? "Workspace" : "Riêng tư"}</span></div><div className="row-actions"><Link className="icon-btn" href={`/reader/${book.id}`} title="Đọc"><BookOpen size={15}/></Link><Link className="icon-btn" href={`/editor/${book.id}`} title="Chỉnh sửa"><Pencil size={15}/></Link>{book.pages.length > 0 && <button className="icon-btn" title="Nhân bản" onClick={() => store.duplicateBook(book.id)}><Copy size={15}/></button>}{book.pages.length > 0 && book.status !== "template" && <button className="icon-btn" title="Tạo template từ sách này" onClick={() => { const template = store.createTemplateFromBook(book.id); if (template) window.location.href = "/templates"; }}><LayoutTemplate size={15}/></button>}{book.status !== "published" && <button className="icon-btn" title="Xuất bản" onClick={() => store.publishBook(book.id)}><Send size={15}/></button>}{!book.archivedAt && <button className="icon-btn" title="Lưu trữ" onClick={() => store.archiveBook(book.id)}><Archive size={15}/></button>}<button className="icon-btn danger" title="Xóa vĩnh viễn" onClick={() => openDelete(book)}><Trash2 size={15}/></button></div></article>)}</div> : <EmptyState icon={BookOpen} title="Chưa có dự án phù hợp" description="Thay đổi bộ lọc hoặc tạo một cuốn sách mới." action={<button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15}/>Tạo sách</button>}/>} 
    </section>
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo dự án sách mới" description="Bạn có thể bắt đầu từ trang trắng hoặc áp dụng template sau trong Studio."><div className="form-grid"><label className="field full"><span>Tên sách</span><input className="input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Giáo trình Makeup Cô Dâu"/></label><label className="field full"><span>Mô tả ngắn</span><textarea className="textarea" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="Mục tiêu và nội dung chính của cuốn sách..."/></label></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={create}><Plus size={15}/>Tạo và mở Studio</button></div></Modal>
    <Modal open={Boolean(deleteTarget)} onClose={() => (deleting ? null : setDeleteTarget(null))} title="Xóa vĩnh viễn sách?" description="Hành động này không thể hoàn tác.">
      <div className="delete-confirm">
        <p className="delete-confirm-warning"><AlertTriangle size={16}/> Sách <strong>{deleteTarget?.title}</strong> sẽ bị xóa vĩnh viễn khỏi thư viện, đồng bộ cloud (Supabase) và các file ảnh/trang đi kèm trên R2. Không có thùng rác — không khôi phục được.</p>
        <label className="field full"><span>Nhập <strong>XÓA</strong> để xác nhận lần 2</span><input className="input" value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} placeholder="XÓA" autoComplete="off" disabled={deleting}/></label>
        {deleteError ? <p className="delete-confirm-error">{deleteError}</p> : null}
      </div>
      <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Hủy</button><button className="btn btn-danger-solid" onClick={confirmDelete} disabled={deleting || deletePhrase.trim().toUpperCase() !== "XÓA"}><Trash2 size={15}/>{deleting ? "Đang xóa..." : "Xóa vĩnh viễn"}</button></div>
    </Modal>
  </AppShell>;
}
