"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, BookOpen, Copy, Filter, Pencil, Plus, Search, Send, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { emitCreativeEvent } from "@/lib/creative-publishing-v1/events";
import { CreativePageFrame, EmptyPanel, StatusPill, SurfaceCard, styles } from "../creative-shared";

export function BookProjectsV1() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => store.books.filter((book) => !book.archivedAt && (status === "all" || book.status === status) && `${book.title} ${book.subtitle} ${book.category}`.toLowerCase().includes(query.toLowerCase())), [store.books, query, status]);

  const create = () => {
    const book = store.createBook({ title: "Sách mới chưa đặt tên", subtitle: "Bắt đầu xây dựng nội dung có cấu trúc" });
    emitCreativeEvent({ name: "creative_action_clicked", surface: "books", action: "create_book", entityId: book.id });
    window.location.href = `/editor/${book.id}`;
  };

  return <CreativePageFrame active="books" eyebrow="CONTENT WORKSPACE" title="Dự án sách" description="Một nơi quản lý draft, version, review, publish, clone và archive." actions={<><Link href="/creative-publishing-v1-preview/templates" className={styles.secondaryButton}><Sparkles/>Tạo từ template</Link><button className={styles.primaryButton} onClick={create}><Plus/>Sách mới</button></>} metrics={[
    { label: "Dự án", value: store.books.filter((book) => !book.archivedAt).length },
    { label: "Bản nháp", value: store.books.filter((book) => book.status === "draft" && !book.archivedAt).length },
    { label: "Đã xuất bản", value: store.books.filter((book) => book.status === "published" && !book.archivedAt).length },
    { label: "Clone", value: store.clones.length },
  ]}>
    <SurfaceCard title="Danh sách dự án" description="Thao tác luôn đi qua store hiện tại, không tạo store song song.">
      <div className={styles.toolbar}><label className={styles.search}><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên sách, danh mục..."/></label><label className={styles.filter}><Filter/><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option><option value="template">Template</option></select></label></div>
      {filtered.length ? <div className={styles.list}>{filtered.map((book) => <article key={book.id} className={styles.listRow}><span className={styles.bookCover} style={{ background: book.cover }}><BookOpen/></span><div className={styles.rowMain}><div className={styles.titleLine}><strong>{book.title}</strong><StatusPill tone={book.status === "published" ? "success" : book.status === "template" ? "info" : "warning"}>{book.status === "published" ? "Đã xuất bản" : book.status === "template" ? "Template" : "Bản nháp"}</StatusPill></div><p>{book.subtitle}</p><small>{book.pages.length} trang · v{book.version} · {book.studentCount} học viên · {book.cloneCount} clone</small></div><div className={styles.rowValue}><strong>{book.price.toLocaleString("vi-VN")} đ</strong><small>{book.visibility}</small></div><div className={styles.rowActions}><Link href={`/reader/${book.id}`} title="Đọc"><BookOpen/></Link><Link href={`/editor/${book.id}`} title="Chỉnh sửa"><Pencil/></Link><button title="Nhân bản" onClick={() => store.duplicateBook(book.id)}><Copy/></button>{book.status !== "published" ? <button title="Xuất bản" onClick={() => store.publishBook(book.id)}><Send/></button> : null}<button title="Lưu trữ" onClick={() => store.archiveBook(book.id)}><Archive/></button></div></article>)}</div> : <EmptyPanel title="Không tìm thấy dự án" description="Đổi bộ lọc hoặc tạo sách mới."/>}
    </SurfaceCard>
  </CreativePageFrame>;
}
