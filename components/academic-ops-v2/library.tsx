"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { BookOpen, Clock3, Eye, LibraryBig, Search, Users } from "lucide-react";
import { AcademicOpsFlowBar, IntelligenceHeader } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicLibraryV2() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const books = useMemo(() => store.books.filter((book) => !book.archivedAt && (filter === "all" || book.status === filter) && `${book.title} ${book.subtitle} ${book.category}`.toLowerCase().includes(query.toLowerCase())), [store.books, query, filter]);
  const featured = books[0] ?? store.books[0];

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="DIGITAL LEARNING LIBRARY" title="Thư viện học" description="Cấp nội dung cho lớp, tiếp tục tiến độ và theo dõi mức độ sử dụng." actions={<><Link href="/classes" className="btn btn-secondary"><Users size={16}/>Cấp theo lớp</Link><Link href="/books" className="btn btn-primary"><LibraryBig size={16}/>Quản lý sách</Link></>}/>
        {featured ? <section className={styles.hero}><div><span className={styles.eyebrow}>THƯ VIỆN NỔI BẬT</span><h1>{featured.title}</h1><p>{featured.subtitle}</p><Link className="btn btn-primary" href={`/reader/${featured.id}`}><BookOpen size={16}/>Tiếp tục đọc</Link></div><div className={styles.orb}><BookOpen size={58}/></div></section> : null}
        <div className={styles.toolbar}>
          <div className={styles.search}><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm trong thư viện..."/></div>
          <div className={styles.tabs}>{[["all","Tất cả"],["published","Đã xuất bản"],["draft","Bản nháp"],["template","Template"]].map(([value,label]) => <button key={value} data-active={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        </div>
        <section className={styles.cardGrid}>
          {books.map((book, index) => {
            const progress = [68, 24, 100, 42][index % 4];
            return <article className={styles.entityCard} key={book.id}><span className={styles.status}>{progress === 100 ? "Hoàn thành" : `${progress}% tiến độ`}</span><h3>{book.title}</h3><p>{book.subtitle}</p><div className={styles.meta}><span><BookOpen size={12}/> {book.pages.length} trang</span><span><Clock3 size={12}/> {book.readingMinutes} phút</span><span><Eye size={12}/> {book.studentCount} người đọc</span></div><span className={styles.progress}><i style={{ width: `${progress}%` }}/></span><div className={styles.actions}><Link href={`/reader/${book.id}`} className="btn btn-secondary">{progress ? "Tiếp tục đọc" : "Bắt đầu đọc"}</Link></div></article>;
          })}
        </section>
      </div>
    </AppShell>
  );
}
