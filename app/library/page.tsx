"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { BookOpen, Clock3, Eye, LibraryBig, Search, Users } from "lucide-react";

export default function LibraryPage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const books = useMemo(() => store.books.filter((book) => !book.archivedAt && (filter === "all" || book.status === filter) && `${book.title} ${book.subtitle} ${book.category}`.toLowerCase().includes(query.toLowerCase())), [store.books, query, filter]);
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">DIGITAL LEARNING LIBRARY</span><h1>Thư viện học</h1><p>Không gian đọc sách, tiếp tục tiến độ và trình chiếu cho giảng viên.</p></div><div className="header-actions"><Link href="/classes" className="btn btn-secondary"><Users size={16}/>Cấp theo lớp</Link><Link href="/books" className="btn btn-primary"><LibraryBig size={16}/>Quản lý sách</Link></div></div>
    <section className="library-hero"><div><span>THƯ VIỆN NỔI BẬT</span><h2>{store.books[0]?.title}</h2><p>{store.books[0]?.subtitle}</p><div><Link href={`/reader/${store.books[0]?.id}`} className="btn btn-primary"><BookOpen size={16}/>Tiếp tục đọc</Link><span><Clock3 size={15}/>Đã đọc 68%</span></div></div><div className="library-hero-book" style={{ background: store.books[0]?.cover }}><small>H2OBOOK EDUCATION</small><strong>{store.books[0]?.title}</strong></div></section>
    <div className="library-toolbar"><div className="search-box compact"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm trong thư viện..."/></div><div className="filter-tabs inline">{[["all","Tất cả"],["published","Đã xuất bản"],["draft","Bản nháp"],["template","Template"]].map(([value,label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
    <div className="library-grid">{books.map((book, index) => { const progress = [68, 24, 100, 42][index % 4]; return <article className="library-book-card" key={book.id}><div className="library-book-cover" style={{ background: book.cover }}><div className="library-book-shine"/><small>{book.category}</small><h3>{book.title}</h3><span>{book.author}</span></div><div className="library-book-info"><div className="library-book-title"><strong>{book.title}</strong><Badge tone={progress === 100 ? "success" : "neutral"}>{progress === 100 ? "Hoàn thành" : `${progress}%`}</Badge></div><p>{book.subtitle}</p><div className="library-book-meta"><span><BookOpen size={14}/>{book.pages.length} trang</span><span><Clock3 size={14}/>{book.readingMinutes} phút</span><span><Eye size={14}/>{book.studentCount} người đọc</span></div><div className="progress"><span style={{ width: `${progress}%` }}/></div><Link href={`/reader/${book.id}`} className="btn btn-secondary">{progress ? "Tiếp tục đọc" : "Bắt đầu đọc"}</Link></div></article>; })}</div>
  </AppShell>;
}
