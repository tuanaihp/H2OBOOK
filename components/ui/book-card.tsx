"use client";

import Link from "next/link";
import { BookOpen, Copy, Pencil } from "lucide-react";
import type { H2OBook } from "@/types/editor";
import { useAppStore } from "@/store/app-store";
import { Badge } from "./badge";

export function BookCard({ book }: { book: H2OBook }) {
  const duplicateBook = useAppStore((state) => state.duplicateBook);
  const label = book.status === "published" ? "Đã xuất bản" : book.status === "template" ? "Template" : "Bản nháp";
  const tone = book.status === "published" ? "success" : book.status === "template" ? "purple" : "warning";
  return <article className="book-card"><div className="book-cover" style={{ background: book.cover }}><span className="book-cover-label">H2OBOOK EDUCATION</span><div className="book-cover-title">{book.title}</div></div><div className="book-card-body"><div className="book-title">{book.title}</div><div className="book-subtitle">{book.subtitle}</div><div className="book-meta"><Badge tone={tone}>{label}</Badge><div className="row-actions"><Link className="icon-btn compact-icon" href={`/reader/${book.id}`} title="Đọc"><BookOpen size={14}/></Link><Link className="icon-btn compact-icon" href={`/editor/${book.id}`} title="Chỉnh sửa"><Pencil size={14}/></Link><button className="icon-btn compact-icon" title="Nhân bản" onClick={() => duplicateBook(book.id)}><Copy size={14}/></button></div></div></div></article>;
}
